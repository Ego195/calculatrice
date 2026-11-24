import csv
import hmac
import io
import json
import logging
import os
import urllib.parse
import urllib.error
import urllib.request
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

load_dotenv()

DEFAULT_CHOICES = ("Tr\u00e8s bien", "Bien", "Moyen", "\u00c0 revoir")
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
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)


class VotePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    survey_id: uuid.UUID
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
        choice = " ".join(value.split())
        if not choice or len(choice) > 80:
            raise ValueError("Le choix doit contenir de 1 a 80 caracteres.")
        return choice


class ExportPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    admin_key: str


class UpdateSurveyPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    admin_key: str
    title: str
    question: str
    instruction: str
    choice_heading: str = "VOTRE CHOIX"

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value or len(value) > 80:
            raise ValueError("Le titre doit contenir de 1 a 80 caracteres.")
        return value

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        if not value or len(value) > 180:
            raise ValueError("La question doit contenir de 1 a 180 caracteres.")
        return value

    @field_validator("instruction", "choice_heading")
    @classmethod
    def validate_short_text(cls, value: str) -> str:
        if not value or len(value) > 120:
            raise ValueError("Ce texte doit contenir de 1 a 120 caracteres.")
        return value


class DeleteSurveyPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    admin_key: str


class SurveyChoicePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    label: str
    description: str = ""
    mark: str = "✳"

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        if not value or len(value) > 80:
            raise ValueError("Chaque choix doit contenir de 1 a 80 caracteres.")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        if len(value) > 120:
            raise ValueError("La description d'un choix est limitee a 120 caracteres.")
        return value

    @field_validator("mark")
    @classmethod
    def validate_mark(cls, value: str) -> str:
        if not value or len(value) > 8:
            raise ValueError("Le symbole d'un choix est invalide.")
        return value


class CreateSurveyPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    admin_key: str
    title: str
    question: str
    instruction: str
    choice_heading: str = "VOTRE CHOIX"
    choices: list[SurveyChoicePayload]

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value or len(value) > 80:
            raise ValueError("Le titre doit contenir de 1 a 80 caracteres.")
        return value

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        if not value or len(value) > 180:
            raise ValueError("La question doit contenir de 1 a 180 caracteres.")
        return value

    @field_validator("instruction", "choice_heading")
    @classmethod
    def validate_short_text(cls, value: str) -> str:
        if not value or len(value) > 120:
            raise ValueError("Ce texte doit contenir de 1 a 120 caracteres.")
        return value

    @model_validator(mode="after")
    def validate_choices(self):
        if not 2 <= len(self.choices) <= 8:
            raise ValueError("Un sondage doit proposer entre 2 et 8 choix.")
        labels = [choice.label.casefold() for choice in self.choices]
        if len(set(labels)) != len(labels):
            raise ValueError("Chaque choix doit avoir un nom different.")
        return self


def supabase_request(
    method: str,
    resource: str,
    payload: dict | None = None,
    *,
    admin: bool = False,
):
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key_name = "SUPABASE_SECRET_KEY" if admin else "SUPABASE_PUBLISHABLE_KEY"
    api_key = os.getenv(key_name, "").strip()
    if not base_url or not api_key:
        raise HTTPException(
            status_code=503,
            detail=f"SUPABASE_URL et {key_name} doivent etre configurees.",
        )

    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "apikey": api_key,
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = (
            "return=representation"
            if resource.startswith("rpc/") or method == "PATCH"
            else "return=minimal"
        )
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
            detail = "Supabase refuse l'acces. Verifie la cle et les policies SQL."
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
    supabase_request("GET", "surveys?select=id&is_active=eq.true&limit=1")
    return {"status": "ok", "database": "supabase"}


def survey_resource(survey_id: str) -> str:
    return urllib.parse.urlencode(
        {
            "select": "id,title,question,instruction,choice_heading,is_active,created_at,"
            "survey_choices(id,label,description,mark,sort_order)",
            "id": f"eq.{survey_id}",
            "limit": "1",
        }
    )


def get_survey(survey_id: str) -> dict[str, object]:
    rows = supabase_request("GET", f"surveys?{survey_resource(survey_id)}")
    if not rows:
        raise HTTPException(status_code=404, detail="Ce sondage n'existe pas.")
    survey = rows[0]
    survey["choices"] = sorted(
        survey.pop("survey_choices", []),
        key=lambda choice: choice["sort_order"],
    )
    return survey


def active_survey_id() -> str:
    rows = supabase_request(
        "GET",
        "surveys?select=id&is_active=eq.true&limit=1",
    )
    if not rows:
        raise HTTPException(
            status_code=503,
            detail="Aucun sondage actif. Creez-en un depuis l'espace administrateur.",
        )
    return str(rows[0]["id"])


def survey_results(survey_id: str) -> dict[str, object]:
    survey = get_survey(survey_id)
    if not survey["is_active"]:
        raise HTTPException(status_code=404, detail="Ce sondage n'est plus actif.")
    rows = supabase_request(
        "GET",
        "votes?"
        + urllib.parse.urlencode(
            {
                "select": "choice",
                "survey_id": f"eq.{survey_id}",
                "limit": "10000",
            }
        ),
    )
    counts = {choice["label"]: 0 for choice in survey["choices"]}
    for row in rows:
        if row["choice"] in counts:
            counts[row["choice"]] += 1

    total = sum(counts.values())
    return {
        "survey": survey,
        "total": total,
        "results": [
            {
                "label": choice["label"],
                "description": choice["description"],
                "mark": choice["mark"],
                "count": counts[choice["label"]],
                "percentage": (
                    round(counts[choice["label"]] * 100 / total) if total else 0
                ),
            }
            for choice in survey["choices"]
        ],
    }


@app.get("/api/surveys")
def surveys() -> dict[str, list[dict[str, object]]]:
    resource = urllib.parse.urlencode(
        {
            "select": "id,title,question,instruction,choice_heading,is_active,created_at,"
            "survey_choices(id,label,description,mark,sort_order)",
            "order": "created_at.desc",
            "limit": "50",
        }
    )
    rows = supabase_request("GET", f"surveys?{resource}")
    for survey in rows:
        survey["choices"] = sorted(
            survey.pop("survey_choices", []),
            key=lambda choice: choice["sort_order"],
        )
    return {"surveys": rows}


@app.get("/api/surveys/active")
def active_survey() -> dict[str, object]:
    return survey_results(active_survey_id())


def require_admin_key(candidate: str) -> None:
    expected_key = os.getenv("ADMIN_KEY", "").strip()
    if not expected_key:
        raise HTTPException(status_code=503, detail="ADMIN_KEY n'est pas configuree.")
    if not hmac.compare_digest(candidate, expected_key):
        raise HTTPException(status_code=403, detail="Cle administrateur incorrecte.")


@app.post("/api/admin/session")
def verify_admin(payload: ExportPayload) -> dict[str, bool]:
    require_admin_key(payload.admin_key)
    return {"authorized": True}


@app.post("/api/surveys", status_code=201)
def create_survey(survey: CreateSurveyPayload) -> dict[str, str]:
    require_admin_key(survey.admin_key)

    payload = survey.model_dump(exclude={"admin_key"})
    created_id = supabase_request(
        "POST",
        "rpc/create_survey",
        {"survey_data": payload},
        admin=True,
    )
    return {"id": str(created_id)}


@app.patch("/api/surveys/active")
def update_active_survey(payload: UpdateSurveyPayload) -> dict[str, str]:
    require_admin_key(payload.admin_key)
    survey_data = payload.model_dump(exclude={"admin_key"})
    updated_id = supabase_request(
        "POST",
        "rpc/update_active_survey",
        {"survey_data": survey_data},
        admin=True,
    )
    return {"id": str(updated_id)}


@app.post("/api/surveys/{survey_id}/delete")
def delete_archived_survey(
    survey_id: uuid.UUID,
    payload: DeleteSurveyPayload,
) -> dict[str, object]:
    require_admin_key(payload.admin_key)
    survey = get_survey(str(survey_id))
    if survey["is_active"]:
        raise HTTPException(
            status_code=409,
            detail="Le sondage actif ne peut pas etre supprime.",
        )
    supabase_request(
        "POST",
        "rpc/delete_archived_survey",
        {"target_survey_id": str(survey_id)},
        admin=True,
    )
    return {"id": str(survey_id), "deleted": True}


@app.get("/api/votes")
def votes(survey_id: uuid.UUID | None = None) -> dict[str, list[dict[str, object]]]:
    selected_survey_id = str(survey_id) if survey_id else active_survey_id()
    resource = urllib.parse.urlencode(
        {
            "select": "id,nickname,choice,created_at",
            "survey_id": f"eq.{selected_survey_id}",
            "order": "created_at.desc,id.desc",
            "limit": "100",
        }
    )
    rows = supabase_request("GET", f"votes?{resource}")
    return {"votes": rows}


@app.post("/api/votes", status_code=201)
def create_vote(vote: VotePayload) -> dict[str, str]:
    if active_survey_id() != str(vote.survey_id):
        raise HTTPException(
            status_code=409,
            detail="Ce sondage n'est plus actif. Actualisez la page avant de voter.",
        )
    supabase_request(
        "POST",
        "votes",
        {
            "survey_id": str(vote.survey_id),
            "nickname": vote.nickname,
            "choice": vote.choice,
        },
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
    require_admin_key(payload.admin_key)

    resource = urllib.parse.urlencode(
        {
            "select": "id,nickname,choice,created_at,survey_id,surveys(title)",
            "order": "id.asc",
            "limit": "10000",
        }
    )
    rows = supabase_request("GET", f"votes?{resource}")
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(("id", "sondage_id", "sondage", "pseudonyme", "reponse", "date"))
    for row in rows:
        survey = row.get("surveys") or {}
        writer.writerow(
            safe_csv_cell(value)
            for value in (
                row["id"],
                row["survey_id"],
                survey.get("title", ""),
                row["nickname"],
                row["choice"],
                row["created_at"],
            )
        )
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="sondage-classe.csv"',
            "Cache-Control": "no-store",
        },
    )
