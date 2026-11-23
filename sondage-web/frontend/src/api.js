const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(
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

export async function fetchResults() {
  const response = await request("/api/results");
  return response.json();
}

export async function fetchVotes() {
  const response = await request("/api/votes");
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

export async function downloadCsv(adminKey) {
  return request("/api/export.csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: adminKey }),
  });
}
