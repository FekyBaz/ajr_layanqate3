# أجر لا ينقطع — Ajr La Yanqati

Arabic-first community project for submitting and reviewing **dhikr, dua, ayah, and hadith** content.

The project is designed to run as a lightweight serverless application using **Netlify Functions + Supabase**.

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

## Architecture

```
Browser
  │
  ├── Static frontend
  │
  └── /api/*
        │
        ▼
   Netlify Functions
        │
        ▼
     Supabase
```

Main application areas:

- `netlify/functions/` — serverless API and shared utilities
- `api/migrations/` — database migrations
- `components/`, `pages/` — UI code
- `lib/` — client-side utilities
- `netlify.toml` — Netlify configuration

## Local development

### Requirements

- Node.js 18+
- npm
- A Supabase project
- Netlify CLI

### Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
cd netlify/functions
npm install
cd ../..
```

3. Create your local environment file from the example:

```bash
cp api/.env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item api/.env.example .env
```

4. Fill in your own Supabase credentials and locally generated admin secret.
5. Apply the required SQL migrations from the repository.
6. Start the local environment:

```bash
npm run dev
```

The exact local URL depends on the Netlify CLI configuration.

## Environment variables

Never commit real values.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase credential; keep secret |
| `SUPABASE_ANON_KEY` | Public Supabase key where required |
| `ADMIN_API_KEY` | Protects admin API endpoints |
| `FRONTEND_URL` | Frontend origin |
| `ALLOWED_ORIGINS` | Allowed CORS origins |
| `RATE_LIMIT_*` | Rate-limit configuration |
| `MEMORY_RATE_LIMIT_*` | Memory/submission rate limits |
| `IP_SALT` | Salt used for IP-derived identifiers |
| `GA_MEASUREMENT_ID` | Optional GA4 measurement ID |

See [api/.env.example](./api/.env.example) for placeholders.

## Database

The repository contains SQL migrations used by the application. Review them before applying them to a production Supabase project.

Do not copy production credentials, project URLs, or private data into migration files.

## Deployment

The supported deployment target in the current codebase is **Netlify**.

1. Import the repository into Netlify.
2. Configure the required environment variables in Netlify.
3. Apply the database migrations to your Supabase project.
4. Deploy.
5. Verify the health endpoint and the public submission/review flows.

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

Admin endpoints require the configured admin authorization mechanism.

## Privacy and analytics

The project includes custom analytics and can optionally load GA4.

Before deploying a public instance, operators should:

- Review the data actually collected by the current version.
- Configure analytics according to applicable privacy requirements.
- Avoid collecting personal data unless it is necessary and documented.
- Keep production credentials outside the repository.
- Review retention and cleanup jobs in the database/functions.

## Security

Security-sensitive material is intentionally excluded from the example configuration.

If you discover a vulnerability, **do not open a public issue**. Follow [SECURITY.md](./SECURITY.md).

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before contributing.

For third-party assets and content, read [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

The original source code is available under the [MIT License](./LICENSE).

The MIT license does **not** automatically grant permission to redistribute third-party content, media, fonts, datasets, or religious source material that may be included in or referenced by the project.

---

**أجر لا ينقطع • Open Source**
