# TV Tracker Pro – Self‑Hosted with PocketBase Database

## File Hierarchy Map

/
├── index.html # Main SPA
├── help.html # Architecture docs
├── css/styles.css # Styles
├── js/
│ ├── api.js # TVmaze & YouTube API wrappers
│ └── app.js # App controller (PocketBase backend)
├── docker-compose.yml # Nginx + PocketBase services
├── nginx.conf # Nginx reverse proxy config
├── pb_init.js # One‑time PocketBase collection setup
├── pb_data/ # Persistent SQLite DB (auto‑created)
└── README.md

## Architecture

- **Frontend:** Vanilla JS + Tailwind CSS (static files served by Nginx).
- **Backend:** PocketBase (Go, SQLite) – handles authentication, watchlist CRUD.
- **Database:** SQLite, stored in `pb_data/` volume.
- All API calls go through Nginx (`/api/` → PocketBase).

## Zero‑Idle Efficiency

PocketBase uses ~15 MB RAM idle. Combined with Nginx alpine (~5 MB), the stack runs comfortably under 50 MB, leaving plenty of RAM for peak loads even on a 2 GB VPS.

## Deployment on Coolify (Docker Compose)

1. Clone/copy the entire project folder to your server.
2. Set a strong `PB_ENCRYPTION_KEY` in `docker-compose.yml`.
3. In Coolify, create a **New Service** → **Docker Compose**.
4. Point to your repository (or upload the folder) containing `docker-compose.yml`.
5. Deploy. Coolify will start both containers.
6. **One‑time setup:** Access PocketBase Admin UI at `http://your-server/pb_admin/`.
   - Use the admin email/password shown in the `pocketbase` container logs (`docker logs tvtracker-pb`).
   - Create a `watchlists` collection with the schema described in `pb_init.js`, or simply run the script from your browser console.
7. The app is now ready at `http://your-server`.

## Export Cloud Backup

In the user profile, click “Export Cloud Backup” to download a `.json` file of your watchlist. This can be uploaded manually to Cloudflare R2 / any S3 bucket.

## YouTube Trailer API Key

Replace `YOUR_API_KEY` in `js/api.js` with a valid YouTube Data API v3 key.
