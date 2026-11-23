import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from pydantic import ValidationError

from main import VotePayload, app


class VoteValidationTests(unittest.TestCase):
    def test_normalizes_spaces_in_nickname(self) -> None:
        vote = VotePayload(nickname="  Nova   17  ", choice="Bien")
        self.assertEqual(vote.nickname, "Nova 17")

    def test_rejects_unknown_choice_and_markup(self) -> None:
        with self.assertRaises(ValidationError):
            VotePayload(nickname="Nova", choice="Autre")
        with self.assertRaises(ValidationError):
            VotePayload(nickname="<script>", choice="Bien")


class VoteApiTests(unittest.TestCase):
    def test_vote_is_validated_and_inserted(self) -> None:
        with (
            patch("main.supabase_request") as supabase_request,
            patch("main.send_vote_notification", return_value="not_configured"),
        ):
            response = TestClient(app).post(
                "/api/votes",
                json={"nickname": "Nova-17", "choice": "Bien"},
            )

        self.assertEqual(response.status_code, 201)
        supabase_request.assert_called_once_with(
            "POST",
            "votes",
            {"nickname": "Nova-17", "choice": "Bien"},
        )

    def test_vote_feed_returns_the_stored_names_and_choices(self) -> None:
        rows = [
            {"id": 7, "nickname": "Nova-17", "choice": "Bien", "created_at": "today"}
        ]

        with patch("main.supabase_request", return_value=rows):
            response = TestClient(app).get("/api/votes")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["votes"][0]["nickname"], "Nova-17")
        self.assertEqual(response.json()["votes"][0]["choice"], "Bien")

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
