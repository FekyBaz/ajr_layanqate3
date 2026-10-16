# أجر لا ينقطع — Ajr La Yanqati

Arabic-first community project for submitting and reviewing **dhikr, dua, ayah, and hadith** content.

The migration branch is being prepared for **Vercel Functions + Supabase**. Netlify configuration remains temporarily available as a rollback path while the Vercel preview is validated; it is not used by the new Vercel routes.

> **Open-source note:** The source code is licensed under the MIT License. Third-party content and assets may have separate licenses; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Features

- RTL Arabic-first interface
- Public content submission flow
- Admin review workflow
- Duplicate detection using SHA-256 hashes
- Input sanitization and validation
- Rate limiting
- Admin API-key protection
- CORS and security headers
- Health-check endpoint
- Privacy-conscious custom analytics
- Optional Google Analytics 4 integration
- Ongoing-charity/memory pages with crawler-specific Open Graph metadata

## Architecture

```
Browser
  |
  +-- Static HTML/CSS/JS
  |
  +-- /api/*
        |
        v
    Vercel Node.js Functions
        |
        v
      Supabase
```

Main application areas:

- `api/` — Vercel HTTP routes and database migrations
- `server/functions/` — platform-neutral handler logic shared by the Vercel adapters
- `server/vercel-adapter.js` — maps Node.js requests to the existing handler contract; also secures scheduled invocations
- `vercel.json` — clean-page rewrites, security/cache headers, and cron schedules
- `lib/`, `components/`, `pages/` — browser-side utilities and UI code
- `netlify.toml` and `netlify/functions/` — temporary fallback during migration; to be removed after Vercel is verified and the domain cutover is complete

## Local development

### Requirements

- Node.js 24 (see `.nvmrc`)
- npm
- A Supabase project

Install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```powershell
Copy-Item api/.env.example .env
```

Fill in your own Supabase credentials and a locally generated admin secret. Do not use production service-role credentials for a local or preview environment unless you intentionally accept the risk. Apply the required SQL migrations to a development/staging database, then run:

```bash
npm run dev
```

The Vercel CLI runs the project at its local development URL. It can be installed through `npx vercel dev` if it is not installed globally.

## Environment variables

Never commit real values. Vercel supplies `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL` when available; these are used only to allow the exact active deployment origin for CORS, not a wildcard for all `vercel.app` sites.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase credential; keep secret |
| `SUPABASE_ANON_KEY` | Public read key where required |
| `ADMIN_API_KEY` | Protects admin API endpoints |
| `FRONTEND_URL` | Primary frontend origin |
| `ALLOWED_ORIGINS` | Optional comma-separated extra origins |
| `CRON_SECRET` | Required to authenticate Vercel scheduled routes |
| `RATE_LIMIT_*` | Rate-limit configuration |
| `MEMORY_RATE_LIMIT_*` | Memory/submission rate limits |
| `IP_SALT` | Salt used for IP-derived identifiers |
| `GA_MEASUREMENT_ID` | Optional GA4 measurement ID |
| `GA4_PROPERTY_ID`, Google credentials | Optional server-side GA4 dashboard |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional admin notifications |

See [api/.env.example](./api/.env.example) for placeholders.

## Database

The repository contains SQL migrations used by the application. Review them before applying them to a production Supabase project. Do not copy credentials, project URLs, or private data into migration files.

## Deployment

Import the repository into Vercel and use the `feat/vercel-migration` branch for the first preview. Configure the required environment variables for the Preview environment, preferably against a staging Supabase project. Verify the public and administrative flows before assigning the production domain or removing the temporary Netlify fallback.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the project-specific deployment checklist.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/submit` | Submit content |
| GET | `/api/admin/pending` | List pending submissions |
| POST | `/api/admin/approve` | Approve a submission |
| POST | `/api/admin/reject` | Reject a submission |
| GET | `/api/admin/stats` | Submission statistics |
| GET | `/api/health` | Health check |
| GET | `/api/community/submissions` | Public community submissions |
| POST | `/api/analytics` | Privacy-conscious analytics ingestion |

Admin endpoints require the configured admin authorization mechanism.

## Privacy and analytics

Before deploying a public instance, review the data actually collected by the current version, configure analytics according to applicable privacy requirements, avoid collecting unnecessary personal data, keep production credentials outside the repository, and review retention and cleanup jobs.

## Security

Security-sensitive material is intentionally excluded from the example configuration. If you discover a vulnerability, **do not open a public issue**. Follow [SECURITY.md](./SECURITY.md).

## Roadmap and contributing

See [ROADMAP.md](./ROADMAP.md) for planned work. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before contributing.

## License

The original source code is available under the [MIT License](./LICENSE). The MIT license does **not** automatically grant permission to redistribute third-party content, media, fonts, datasets, or religious source material that may be included in or referenced by the project.

---

**أجر لا ينقطع • Open Source**
