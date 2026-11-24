import os
import unittest
import uuid
from urllib.parse import unquote
from unittest.mock import patch

from fastapi.testclient import TestClient

from pydantic import ValidationError

from main import CreateSurveyPayload, VotePayload, app, supabase_request


class VoteValidationTests(unittest.TestCase):
    survey_id = uuid.UUID("11111111-1111-4111-8111-111111111111")

    def test_normalizes_spaces_in_nickname(self) -> None:
        vote = VotePayload(
            survey_id=self.survey_id,
            nickname="  Nova   17  ",
            choice="Bien",
        )
        self.assertEqual(vote.nickname, "Nova 17")

    def test_rejects_markup_and_oversized_choice(self) -> None:
        with self.assertRaises(ValidationError):
            VotePayload(survey_id=self.survey_id, nickname="<script>", choice="Bien")
        with self.assertRaises(ValidationError):
            VotePayload(
                survey_id=self.survey_id,
                nickname="Nova",
                choice="x" * 81,
            )

    def test_survey_requires_two_to_eight_distinct_choices(self) -> None:
        with self.assertRaises(ValidationError):
            CreateSurveyPayload(
                admin_key="admin",
                title="Séance",
                question="Question ?",
                instruction="Choisis.",
                choices=[{"label": "Oui"}],
            )
        with self.assertRaises(ValidationError):
            CreateSurveyPayload(
                admin_key="admin",
                title="Séance",
                question="Question ?",
                instruction="Choisis.",
                choices=[{"label": "Oui"}, {"label": "oui"}],
            )


class VoteApiTests(unittest.TestCase):
    survey_id = "11111111-1111-4111-8111-111111111111"

    def test_vote_is_validated_and_inserted(self) -> None:
        with (
            patch(
                "main.supabase_request",
                side_effect=[[{"id": self.survey_id}], None],
            ) as supabase_request,
            patch("main.send_vote_notification", return_value="not_configured"),
        ):
            response = TestClient(app).post(
                "/api/votes",
                json={
                    "survey_id": self.survey_id,
                    "nickname": "Nova-17",
                    "choice": "Bien",
                },
            )

        self.assertEqual(response.status_code, 201)
        supabase_request.assert_any_call(
            "POST",
            "votes",
            {
                "survey_id": self.survey_id,
                "nickname": "Nova-17",
                "choice": "Bien",
            },
        )

    def test_vote_to_archived_survey_is_rejected(self) -> None:
        with (
            patch(
                "main.supabase_request",
                return_value=[{"id": "22222222-2222-4222-8222-222222222222"}],
            ) as supabase_request,
            patch("main.send_vote_notification") as notification,
        ):
            response = TestClient(app).post(
                "/api/votes",
                json={
                    "survey_id": self.survey_id,
                    "nickname": "Nova-17",
                    "choice": "Bien",
                },
            )

        self.assertEqual(response.status_code, 409)
        supabase_request.assert_called_once()
        notification.assert_not_called()

    def test_vote_feed_returns_the_stored_names_and_choices(self) -> None:
        rows = [
            {"id": 7, "nickname": "Nova-17", "choice": "Bien", "created_at": "today"}
        ]

        with patch("main.supabase_request", return_value=rows):
            response = TestClient(app).get(f"/api/votes?survey_id={self.survey_id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["votes"][0]["nickname"], "Nova-17")
        self.assertEqual(response.json()["votes"][0]["choice"], "Bien")

    def test_active_results_follow_the_surveys_dynamic_choices(self) -> None:
        survey = {
            "id": self.survey_id,
            "title": "Séance 2",
            "question": "Comment ça va ?",
            "instruction": "Choisis une réponse.",
            "choice_heading": "TON AVIS",
            "is_active": True,
            "created_at": "today",
            "survey_choices": [
                {"id": 1, "label": "Clair", "description": "", "mark": "✳", "sort_order": 0},
                {"id": 2, "label": "À revoir", "description": "", "mark": "◌", "sort_order": 1},
            ],
        }
        votes = [{"choice": "Clair"}, {"choice": "Clair"}, {"choice": "À revoir"}]

        with patch(
            "main.supabase_request",
            side_effect=[[{"id": self.survey_id}], [survey], votes],
        ):
            response = TestClient(app).get("/api/surveys/active")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 3)
        self.assertEqual(
            [item["label"] for item in response.json()["results"]],
            ["Clair", "À revoir"],
        )
        self.assertEqual(response.json()["results"][0]["percentage"], 67)

    def test_survey_creation_requires_admin_key(self) -> None:
        with (
            patch.dict(os.environ, {"ADMIN_KEY": "test-key"}),
            patch("main.supabase_request") as supabase_request,
        ):
            response = TestClient(app).post(
                "/api/surveys",
                json={
                    "admin_key": "wrong-key",
                    "title": "Séance 2",
                    "question": "Comment ça va ?",
                    "instruction": "Choisis une réponse.",
                    "choice_heading": "TON AVIS",
                    "choices": [
                        {"label": "Bien", "description": "Tout va bien", "mark": "✳"},
                        {"label": "Moyen", "description": "À améliorer", "mark": "◌"},
                    ],
                },
            )

        self.assertEqual(response.status_code, 403)
        supabase_request.assert_not_called()

    def test_admin_session_rejects_an_invalid_key(self) -> None:
        with patch.dict(os.environ, {"ADMIN_KEY": "test-key"}):
            response = TestClient(app).post(
                "/api/admin/session",
                json={"admin_key": "wrong-key"},
            )

        self.assertEqual(response.status_code, 403)

    def test_admin_session_accepts_the_configured_key(self) -> None:
        with patch.dict(os.environ, {"ADMIN_KEY": "test-key"}):
            response = TestClient(app).post(
                "/api/admin/session",
                json={"admin_key": "test-key"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"authorized": True})

    def test_active_survey_text_can_be_updated(self) -> None:
        fields = {
            "title": "Séance 3",
            "question": "Quel thème retenir ?",
            "instruction": "Choisis une réponse.",
            "choice_heading": "TON AVIS",
        }
        with (
            patch.dict(os.environ, {"ADMIN_KEY": "test-key"}),
            patch("main.supabase_request", return_value=self.survey_id) as request,
        ):
            response = TestClient(app).patch(
                "/api/surveys/active",
                json={"admin_key": "test-key", **fields},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.survey_id)
        request.assert_called_once_with(
            "POST",
            "rpc/update_active_survey",
            {"survey_data": fields},
            admin=True,
        )

    def test_archived_survey_and_votes_can_be_deleted(self) -> None:
        archived_survey = {
            "id": self.survey_id,
            "is_active": False,
            "survey_choices": [],
        }
        with (
            patch.dict(os.environ, {"ADMIN_KEY": "test-key"}),
            patch(
                "main.supabase_request",
                side_effect=[[archived_survey], self.survey_id],
            ) as request,
        ):
            response = TestClient(app).post(
                f"/api/surveys/{self.survey_id}/delete",
                json={"admin_key": "test-key"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": self.survey_id, "deleted": True})
        self.assertEqual(
            request.call_args_list[1].args[:2],
            ("POST", "rpc/delete_archived_survey"),
        )
        self.assertTrue(request.call_args_list[1].kwargs["admin"])

    def test_active_survey_cannot_be_deleted(self) -> None:
        active_survey = {
            "id": self.survey_id,
            "is_active": True,
            "survey_choices": [],
        }
        with (
            patch.dict(os.environ, {"ADMIN_KEY": "test-key"}),
            patch("main.supabase_request", return_value=[active_survey]) as request,
        ):
            response = TestClient(app).post(
                f"/api/surveys/{self.survey_id}/delete",
                json={"admin_key": "test-key"},
            )

        self.assertEqual(response.status_code, 409)
        request.assert_called_once()

    def test_survey_creation_calls_transactional_rpc(self) -> None:
        with (
            patch.dict(os.environ, {"ADMIN_KEY": "test-key"}),
            patch("main.supabase_request", return_value=self.survey_id) as request,
        ):
            response = TestClient(app).post(
                "/api/surveys",
                json={
                    "admin_key": "test-key",
                    "title": "Séance 2",
                    "question": "Comment ça va ?",
                    "instruction": "Choisis une réponse.",
                    "choice_heading": "TON AVIS",
                    "choices": [
                        {"label": "Bien", "description": "Tout va bien", "mark": "✳"},
                        {"label": "Moyen", "description": "À améliorer", "mark": "◌"},
                    ],
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], self.survey_id)
        request.assert_called_once()
        self.assertEqual(request.call_args.args[:2], ("POST", "rpc/create_survey"))
        self.assertTrue(request.call_args.kwargs["admin"])
        self.assertNotIn("admin_key", request.call_args.args[2]["survey_data"])

    def test_export_contains_survey_context(self) -> None:
        with (
            patch.dict(os.environ, {"ADMIN_KEY": "test-key"}),
            patch(
                "main.supabase_request",
                return_value=[
                    {
                        "id": 7,
                        "survey_id": self.survey_id,
                        "surveys": {"title": "Séance 2"},
                        "nickname": "Nova-17",
                        "choice": "Bien",
                        "created_at": "today",
                    }
                ],
            ) as request,
        ):
            response = TestClient(app).post(
                "/api/export.csv",
                json={"admin_key": "test-key"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("sondage_id", response.text)
        self.assertIn("Séance 2", response.text)
        self.assertIn("survey_id", unquote(request.call_args.args[1]))

    def test_survey_rpc_requests_its_return_value(self) -> None:
        with (
            patch.dict(
                os.environ,
                {
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_SECRET_KEY": "test-secret",
                },
            ),
            patch("main.urllib.request.urlopen") as urlopen,
        ):
            urlopen.return_value.__enter__.return_value.read.return_value = (
                f'"{self.survey_id}"'.encode()
            )
            result = supabase_request(
                "POST",
                "rpc/create_survey",
                {"survey_data": {}},
                admin=True,
            )

        self.assertEqual(result, self.survey_id)
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("Prefer"), "return=representation")

    def test_local_frontend_origin_is_allowed_even_when_db_is_missing(self) -> None:
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "", "SUPABASE_PUBLISHABLE_KEY": ""},
        ):
            response = TestClient(app).get(
                "/api/health",
                headers={"Origin": "http://127.0.0.1:5173"},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.headers["access-control-allow-origin"],
            "http://127.0.0.1:5173",
        )


if __name__ == "__main__":
    unittest.main()
