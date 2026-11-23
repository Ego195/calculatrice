import csv
import hmac
import io
import json
import logging
import os
import urllib.parse
import urllib.error
import urllib.request

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, field_validator

load_dotenv()

CHOICES = ("Tr\u00e8s bien", "Bien", "Moyen", "\u00c0 revoir")
logger = logging.getLogger("uvicorn.error")
app = FastAPI(title="Sondage de classe", version="1.0.0")

origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
if os.getenv("RENDER", "").lower() != "true":
    for development_origin in (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ):
        if development_origin not in origins:
            origins.append(development_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class VotePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nickname: str
    choice: str

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, value: str) -> str:
        nickname = " ".join(value.split())
        if (
            not nickname
            or len(nickname) > 30
            or not any(character.isalpha() for character in nickname)
            or any(
                not (character.isalnum() or character in " -'\u2019")
                for character in nickname
            )
        ):
            raise ValueError("Saisis un pseudonyme fictif de 1 a 30 caracteres.")
        return nickname

    @field_validator("choice")
    @classmethod
    def validate_choice(cls, value: str) -> str:
        if value not in CHOICES:
            raise ValueError("Choisis une reponse proposee dans le sondage.")
        return value


class ExportPayload(BaseModel):
    admin_key: str


def supabase_request(method: str, resource: str, payload: dict | None = None):
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not base_url or not publishable_key:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY doivent etre configurees.",
        )

    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "apikey": publishable_key,
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=minimal"
    request = urllib.request.Request(
        f"{base_url}/rest/v1/{resource}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response_body = response.read()
    except urllib.error.HTTPError as error:
        logger.error("Supabase REST request rejected with HTTP %s.", error.code)
        if error.code in (401, 403):
            detail = (
                "Supabase refuse l'acces. Execute backend/supabase_policies.sql "
                "dans le SQL Editor Supabase."
            )
        else:
            detail = f"Supabase a refuse la requete (HTTP {error.code})."
        raise HTTPException(status_code=502, detail=detail) from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        logger.exception("Connexion a Supabase echouee.")
        raise HTTPException(
            status_code=503,
            detail="Supabase est momentanement injoignable.",
        ) from error

    if not response_body:
        return None
    try:
        return json.loads(response_body)
    except json.JSONDecodeError as error:
        logger.exception("Supabase a renvoye une reponse JSON invalide.")
        raise HTTPException(
            status_code=502,
            detail="Supabase a renvoye une reponse invalide.",
        ) from error


def send_vote_notification(nickname: str, choice: str) -> str:
    access_key = os.getenv("WEB3FORMS_ACCESS_KEY", "").strip()
    recipient = os.getenv("NOTIFICATION_EMAIL", "").strip()
    if not access_key or not recipient:
        return "not_configured"

    payload = json.dumps(
        {
            "access_key": access_key,
            "email": recipient,
            "from_name": "Sondage de classe",
            "subject": "Nouvelle reponse au sondage",
            "name": nickname,
            "choice": choice,
            "message": f"Pseudonyme : {nickname}\nChoix : {choice}",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.web3forms.com/submit",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.loads(response.read())
        if result.get("success") is True:
            return "sent"
        logger.error("Web3Forms a refuse la notification du vote.")
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        logger.exception("Impossible d'envoyer la notification Web3Forms.")
    return "failed"


@app.get("/api/health")
def health() -> dict[str, str]:
    supabase_request("GET", "votes?select=id&limit=1")
    return {"status": "ok", "database": "supabase"}


@app.get("/api/results")
def results() -> dict[str, object]:
    counts = {choice: 0 for choice in CHOICES}
    rows = supabase_request(
        "GET",
        "votes?" + urllib.parse.urlencode({"select": "choice", "limit": "10000"}),
    )
    for row in rows:
        if row["choice"] in counts:
            counts[row["choice"]] += 1

    total = sum(counts.values())
    return {
        "total": total,
        "results": [
            {
                "label": choice,
                "count": counts[choice],
                "percentage": round(counts[choice] * 100 / total) if total else 0,
            }
            for choice in CHOICES
        ],
    }


@app.get("/api/votes")
def votes() -> dict[str, list[dict[str, object]]]:
    resource = urllib.parse.urlencode(
        {
            "select": "id,nickname,choice,created_at",
            "order": "created_at.desc,id.desc",
            "limit": "100",
        }
    )
    rows = supabase_request("GET", f"votes?{resource}")
    return {"votes": rows}


@app.post("/api/votes", status_code=201)
def create_vote(vote: VotePayload) -> dict[str, str]:
    supabase_request(
        "POST",
        "votes",
        {"nickname": vote.nickname, "choice": vote.choice},
    )
    notification = send_vote_notification(vote.nickname, vote.choice)
    if notification == "sent":
        message = "Reponse enregistree et notification email envoyee."
    elif notification == "failed":
        message = "Reponse enregistree, mais la notification email a echoue."
    else:
        message = "Reponse enregistree dans Supabase."
    return {"message": message, "notification": notification}


def safe_csv_cell(value: object) -> object:
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


@app.post("/api/export.csv")
def export_csv(payload: ExportPayload) -> Response:
    expected_key = os.getenv("ADMIN_KEY", "")
    if not expected_key:
        raise HTTPException(status_code=503, detail="ADMIN_KEY n'est pas configuree.")
    if not hmac.compare_digest(payload.admin_key, expected_key):
        raise HTTPException(status_code=403, detail="Cle administrateur incorrecte.")

    resource = urllib.parse.urlencode(
        {
            "select": "id,nickname,choice,created_at",
            "order": "id.asc",
            "limit": "10000",
        }
    )
    rows = supabase_request("GET", f"votes?{resource}")
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(("id", "pseudonyme", "reponse", "date"))
    for row in rows:
        writer.writerow(
            safe_csv_cell(row[column])
            for column in ("id", "nickname", "choice", "created_at")
        )
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="sondage-classe.csv"',
            "Cache-Control": "no-store",
        },
    )
