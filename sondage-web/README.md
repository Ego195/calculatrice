# Sondage — React, FastAPI et Supabase

Le site React affiche le sondage actif, ses résultats et les réponses récentes. FastAPI valide les votes et parle à Supabase. La console d'administration est une application Windows séparée : elle permet de modifier le sondage actif, d'en publier un nouveau, de gérer l'historique et d'exporter les votes en CSV. Elle est intégrée à l'installateur et n'est pas publiée sur Vercel.

## Initialiser Supabase

Avant le premier déploiement de cette version :

1. Dans Supabase, ouvrez **SQL Editor** et exécutez `backend/supabase_surveys_migration.sql`. Le script crée les tables `surveys` et `survey_choices`, crée le sondage initial et rattache les votes existants à celui-ci. Il peut être réexécuté sans dupliquer sa contrainte de clé étrangère ni le sondage initial.
2. Exécutez ensuite `backend/supabase_policies.sql` afin d'autoriser la lecture publique et de vérifier que chaque vote correspond à un choix du sondage actif.
3. Exécutez `backend/supabase_admin_management.sql`. Il ajoute les opérations sécurisées de modification du sondage actif et de suppression d'un sondage archivé avec tous ses votes.
4. Configurez les variables d'environnement décrites ci-dessous. Ne mettez jamais une clé secrète Supabase dans le frontend, Git ou un message.

Faites une sauvegarde de la base avant toute migration en production. La clé `SUPABASE_SECRET_KEY` (ou l'ancienne clé `service_role`) doit rester uniquement dans les variables privées de Railway.

## Lancer en local

Dans `sondage-web/backend`, créez un environnement virtuel et installez les dépendances :

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Renseignez `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` et `ADMIN_KEY` dans `backend/.env`, puis lancez l'API :

```powershell
uvicorn main:app --reload --port 8000
```

Dans un autre terminal, depuis la racine du dépôt :

```powershell
npm --prefix sondage-web/frontend ci
npm --prefix sondage-web/frontend run dev
```

Ouvrez `http://localhost:5173`. L'API est disponible sur `http://localhost:8000`; sa documentation se trouve sur `/docs`.

## Configuration et déploiement Railway + Vercel

### API sur Railway

Déployez `sondage-web/backend` depuis le dépôt GitHub et configurez :

- **Start command** : `uvicorn main:app --host 0.0.0.0 --port $PORT`
- `SUPABASE_URL` : URL du projet Supabase.
- `SUPABASE_PUBLISHABLE_KEY` : clé publique Supabase.
- `SUPABASE_SECRET_KEY` : clé secrète Supabase, conservée uniquement côté Railway.
- `ADMIN_KEY` : une clé d'administration longue, générée et conservée privée.
- `FRONTEND_ORIGINS` : origine HTTPS du site Vercel, sans chemin ni slash final.
- `WEB3FORMS_ACCESS_KEY` et `NOTIFICATION_EMAIL` : facultatives pour les notifications par courriel.

Vérifiez `https://<url-api>/api/health`.

### Interface sur Vercel

Pour garder accessibles les fichiers de la calculatrice qui se trouvent à la racine du dépôt, laissez le **Root Directory** sur la racine du dépôt. Configurez :

- **Build command** : `npm --prefix sondage-web/frontend ci && npm --prefix sondage-web/frontend run build`
- **Output directory** : `sondage-web/frontend/dist`
- `VITE_API_URL` : URL HTTPS de l'API Railway, sans slash final. Si elle est absente, le site utilise l'URL de production connue.

Après avoir déployé Vercel, copiez son origine HTTPS dans `FRONTEND_ORIGINS` sur Railway, puis redéployez l'API afin d'appliquer la configuration CORS.

Le build Vercel ne contient que le site public et la calculatrice. La page source `admin.html` est compilée séparément dans `admin-dist` pour l'application Windows et n'est pas servie par Vercel.

## Application Windows

L'installateur Electron embarque la console sur le PC. Elle n'est pas accessible depuis le site public. Lorsqu'elle est ouverte, l'application démarre un petit serveur limité à `127.0.0.1` et transmet ses appels à l'API Railway; il faut donc une connexion Internet pour administrer les sondages. La clé `ADMIN_KEY` est demandée dans l'application et reste en mémoire pendant la session.

Depuis `sondage-web/frontend`, ou depuis la racine avec `--prefix` :

```powershell
npm --prefix sondage-web/frontend ci
npm --prefix sondage-web/frontend run admin:installer
```

Le script compile d'abord la console dans `admin-dist`, puis crée le programme d'installation NSIS dans `sondage-web/frontend/release`. Il ajoute des raccourcis au menu Démarrer et au bureau. Les variables de configuration Vercel ne sont pas nécessaires pour le build de l'installateur.

## Utiliser l'espace administrateur

Lancez **Sondage Admin** depuis le menu Démarrer ou le raccourci du bureau, puis saisissez la valeur `ADMIN_KEY` configurée sur Railway :

- **Télécharger le CSV** exporte les votes.
- **Modifier le sondage actif** permet de changer le titre, la question et les consignes sans modifier les choix utilisés pour calculer les votes déjà collectés.
- Pour créer un sondage, cliquez **Nouveau sondage**, renseignez son titre, sa question, la consigne et l'intitulé au-dessus des choix. Ajoutez ou retirez des choix (minimum 2, maximum 8), donnez un nom à chacun et, facultativement, une courte description. Cliquez **Publier le sondage**.
- Un sondage archivé peut être supprimé depuis l'historique. La console exige de retaper `SUPPRIMER`; le sondage, ses choix et ses réponses seront alors définitivement effacés.
- Le nouveau sondage devient actif. Les votes existants restent associés à l'ancien sondage; son titre, sa question et ses choix restent visibles dans l'historique.

L'application ne stocke pas la clé administrateur après fermeture ou verrouillage de la session. Pour un déploiement de production, utilisez une clé secrète régénérée si une ancienne clé a déjà été exposée.

## Confidentialité

Les pseudonymes fictifs et les votes sont visibles publiquement dans l'application. N'utilisez pas de vrais noms ou renseignements personnels. Les clés d'administration et les clés secrètes Supabase restent exclusivement dans les variables d'environnement privées du backend.
