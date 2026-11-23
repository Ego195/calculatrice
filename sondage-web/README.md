# Sondage — React, FastAPI et Supabase

Application de sondage de classe. React affiche le formulaire, les resultats et les 100 reponses les plus recentes. FastAPI valide et enregistre les votes dans `public.votes` sur Supabase. Le site inclut egalement la calculatrice existante du depot.

## Lancer en local

Dans `sondage-web/backend`, creez un environnement virtuel et installez les dependances :

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Renseignez `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` dans `backend/.env`, puis lancez l'API :

```powershell
uvicorn main:app --reload --port 8000
```

Dans un autre terminal, depuis la racine du depot :

```powershell
npm --prefix sondage-web/frontend install
npm --prefix sondage-web/frontend run dev
```

Ouvrez `http://localhost:5173`. L'API et sa documentation sont disponibles sur `http://localhost:8000` et `http://localhost:8000/docs`.

Avant le premier vote, executez une fois `backend/supabase_policies.sql` dans le SQL Editor Supabase. La page affiche publiquement les pseudonymes fictifs et leurs choix.

## Deployer sur Render

Le depot contient plusieurs projets. Pour que le site statique puisse aussi copier les fichiers de la calculatrice situes a la racine du depot, **laissez le Root Directory vide pour le Static Site**. Ne publiez jamais le fichier `backend/.env` : les secrets se configurent dans le tableau de bord Render.

### 1. Deployer l'API FastAPI

1. Dans Render, choisissez **New + → Web Service** et connectez le depot GitHub `Ego195/calculatrice`, branche `main`.
2. Configurez le service :
   - **Root Directory** : `sondage-web/backend`
   - **Runtime** : Python 3
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path** : `/api/health`
3. Dans **Environment**, ajoutez :
   - `SUPABASE_URL` : URL du projet Supabase.
   - `SUPABASE_PUBLISHABLE_KEY` : cle publishable Supabase. N'utilisez jamais la `service_role` dans l'application.
   - `ADMIN_KEY` : une longue cle aleatoire, gardee privee, pour proteger l'export CSV.
   - `FRONTEND_ORIGINS` : a completer a l'etape 3 avec l'origine HTTPS du Static Site.
   - `WEB3FORMS_ACCESS_KEY` et `NOTIFICATION_EMAIL` : facultatifs, uniquement si les notifications email sont activees.
4. Lancez le deploiement et notez l'URL HTTPS de l'API, par exemple `https://sondage-api.onrender.com`.
5. Verifiez `https://<url-api>/api/health`. La reponse attendue indique `status: ok` et `database: supabase`.

### 2. Deployer le site React et la calculatrice

1. Dans Render, choisissez **New + → Static Site** avec le meme depot et la branche `main`.
2. Configurez :
   - **Root Directory** : laissez ce champ vide (racine du depot).
   - **Build Command** : `npm --prefix sondage-web/frontend ci && npm --prefix sondage-web/frontend run build`
   - **Publish Directory** : `sondage-web/frontend/dist`
3. Dans **Environment**, ajoutez `VITE_API_URL` avec l'URL HTTPS de l'API de l'etape 1, sans slash final, par exemple `https://sondage-api.onrender.com`.
4. Lancez le deploiement. Render fournit une URL HTTPS pour le site.

Le build Vite copie automatiquement `index.html`, `styles.css` et `app.js` de la calculatrice dans `dist/calculatrice`. Le lien **CALCULATRICE** ouvre `/calculatrice/index.html` dans un nouvel onglet; le sondage reste accessible dans l'onglet initial.

### 3. Autoriser le domaine du site dans l'API

1. Copiez l'origine HTTPS du Static Site, par exemple `https://sondage-classe.onrender.com` (sans chemin ni slash final).
2. Dans le Web Service FastAPI, ajoutez ou mettez a jour `FRONTEND_ORIGINS` avec cette origine. Pour plusieurs domaines, separez-les par des virgules.
3. Relancez le deploiement de l'API pour appliquer la configuration CORS.

### 4. Verifier l'application en ligne

1. Ouvrez l'URL HTTPS du Static Site et verifiez le formulaire et le classement.
2. Cliquez sur **CALCULATRICE** et verifiez que `/calculatrice/index.html` s'ouvre. Revenez au sondage en reprenant l'onglet precedent.
3. Envoyez un vote avec un pseudonyme fictif, puis verifiez sa presence dans le classement et dans `public.votes`.
4. Verifiez aussi `https://<url-api>/api/health` et `https://<url-api>/docs`.

La variable `VITE_API_URL` est integree au build React : si l'URL de l'API change, mettez-la a jour puis redeployez le Static Site. Sur une offre Render qui met le Web Service en veille, le premier appel a l'API peut prendre plus de temps.

## Confidentialite et notifications

Utilisez uniquement des pseudonymes fictifs : la liste des pseudonymes et des choix est publique. Les notifications email sont desactivees tant que `WEB3FORMS_ACCESS_KEY` et `NOTIFICATION_EMAIL` ne sont pas configures. Gardez ces valeurs et `ADMIN_KEY` dans les variables d'environnement privees de Render, jamais dans React ou Git. Regenerez toute cle Web3Forms qui a deja ete exposee dans du code client.
