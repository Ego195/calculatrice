const DEFAULT_API_URL = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://calculatrice-production.up.railway.app";
const configuredApiUrl =
  import.meta.env.VITE_DESKTOP === "true"
    ? ""
    : import.meta.env.VITE_API_URL || DEFAULT_API_URL;
const API_URL = configuredApiUrl.replace(
  /\/$/,
  "",
);

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error(
      "FastAPI est injoignable. Lance l'API sur http://localhost:8000.",
    );
  }

  if (!response.ok) {
    let message = `La requete a echoue (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail.map((issue) => issue.msg).join(" ");
      }
    } catch {
      // Preserve the HTTP status when the server does not return JSON.
    }
    throw new Error(message);
  }
  return response;
}

export async function fetchVotesForSurvey(surveyId) {
  const response = await request(
    `/api/votes?survey_id=${encodeURIComponent(surveyId)}`,
  );
  return response.json();
}

export async function fetchActiveSurvey() {
  const response = await request("/api/surveys/active");
  return response.json();
}

export async function fetchSurveys() {
  const response = await request("/api/surveys");
  return response.json();
}

export async function verifyAdmin(adminKey) {
  const response = await request("/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: adminKey }),
  });
  return response.json();
}

export async function sendVote(vote) {
  const response = await request("/api/votes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vote),
  });
  return response.json();
}

export async function createSurvey(survey) {
  const response = await request("/api/surveys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(survey),
  });
  return response.json();
}

export async function updateActiveSurvey(adminKey, survey) {
  const response = await request("/api/surveys/active", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...survey, admin_key: adminKey }),
  });
  return response.json();
}

export async function deleteArchivedSurvey(adminKey, surveyId) {
  const response = await request(`/api/surveys/${encodeURIComponent(surveyId)}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: adminKey }),
  });
  return response.json();
}

export async function downloadCsv(adminKey) {
  return request("/api/export.csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: adminKey }),
  });
}
