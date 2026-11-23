# Sondage — React, FastAPI et Supabase

Application de sondage de classe. React fournit l'interface, FastAPI valide les votes et Supabase conserve les pseudonymes et les choix dans `public.votes`.

## Lancer en local

Dans `sondage-web/backend`, creez un environnement virtuel, installez les dependances, puis copiez `.env.example` vers `.env` :

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

Renseignez `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` dans le `.env` du backend. La cle publishable n'est pas un mot de passe PostgreSQL. Pour recevoir une notification par reponse avec Web3Forms, renseignez aussi `WEB3FORMS_ACCESS_KEY` et `NOTIFICATION_EMAIL`. La cle Web3Forms actuellement integree dans le code client Contact est visible aux visiteurs : regenerez-la et gardez la nouvelle cle dans `.env` ou les variables privees Render, jamais dans React ou Git.

Avant le premier vote, ouvrez le SQL Editor du projet Supabase et executez une fois `backend/supabase_policies.sql`. Cela autorise seulement la lecture publique et l'insertion de pseudonymes/choix, necessaires a l'interface. Sans cette policy, Supabase peut repondre HTTP 401/403 aux votes.

Dans `sondage-web/frontend` :

```powershell
npm install
npm run dev
```

Ouvrez http://localhost:5173. L'API et sa documentation sont sur `http://localhost:8000` et `/docs`.

## Render

- Frontend: Static Site, racine `sondage-web/frontend`, build `npm install && npm run build`, publication `dist`.
- API: Web Service, racine `sondage-web/backend`, build `pip install -r requirements.txt`, demarrage `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- API: ajoutez `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_KEY`, `FRONTEND_ORIGINS` et, si vous activez les emails, `WEB3FORMS_ACCESS_KEY` et `NOTIFICATION_EMAIL`.
- Frontend: configurez `VITE_API_URL` avec l'URL Render de l'API.

Les pseudonymes et choix apparaissent sur la page publique. Utilisez uniquement des pseudonymes fictifs. L'export CSV est protege par `ADMIN_KEY`.
