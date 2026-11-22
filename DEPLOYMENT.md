# Deployment Guide (Vercel + Supabase)

The application deploys as static files plus Vercel Functions, backed by Supabase. `netlify.toml` and `netlify/functions/` stay in the repository as a rollback path until the Vercel production deployment has been validated.

## 1. Create the Vercel project

1. Import `FekyBaz/ajr_layanqate3` from GitHub.
2. Use the repository root as the Root Directory.
3. Keep the **Other** framework preset. `vercel.json` already sets `framework: null`.
4. Use Node.js 22. `.nvmrc`, `package.json#engines`, CI, and Netlify all pin the same major version.
5. Do not assign the production domain or switch DNS during the first deployment.

`vercel.json` defines the whole build contract:

| Setting | Value |
|---|---|
| `installCommand` | `npm ci --omit=dev` |
| `buildCommand` | `npm run build` |
| `outputDirectory` | `dist` |
| Functions | `api/[...path].js`, `api/health.js`, `api/memory-og/[slug].js` |

`npm run build` runs `scripts/build-public.cjs`, which copies an explicit 95-file allowlist into `dist/`. Database migrations, function source, tests, scripts, docs, and prototypes are never part of the static output.

The three function entries keep the deployment below the Hobby plan's 12-function limit. All 35 business API paths are dispatched from `api/[...path].js` through `server/vercel-router.js`.

## 2. Configure environment variables

Use a development/staging Supabase project for the Preview environment first. Do not point the Preview deployment at the production database until writes, rate limits, admin actions, and scheduled cleanup have been reviewed.

Required variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (current `sb_publishable_...` key; low-privilege and RLS-scoped)
- `SUPABASE_SECRET_KEY` (current `sb_secret_...` key; server-only and bypasses RLS)
- `ADMIN_API_KEY`
- `FRONTEND_URL` (the primary site origin)
- `IP_SALT` (generate an independent random secret for Preview)
- `CRON_SECRET` (random secret of at least 16 characters)

The application intentionally does not read the retired `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` variables. The backend validates the new key prefixes at startup, so a legacy JWT or a pasted documentation block fails fast with a safe configuration error.

The repository uses `@supabase/supabase-js` 2.118 or later. This SDK generation recognizes `sb_publishable_...` and `sb_secret_...` keys and sends them as API keys rather than treating them as legacy JWT bearer tokens.

Optional variables:

- `ALLOWED_ORIGINS` for additional explicit browser origins
- `RUNTIME_DEPLOYMENT_ORIGINS` when a runtime does not supply deployment URLs automatically
- Rate-limit overrides
- GA4 and Telegram variables if those features are being tested

Vercel supplies `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL`. Those exact deployment origins are normalized at the configuration boundary; CORS never allows every `vercel.app` origin. Add secrets in Vercel Project Settings → Environment Variables and select the correct environment (Preview first, Production at cutover). Use Vercel's **Sensitive** type for `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `IP_SALT`, and other server-side secrets. The publishable key is not a secret, but should still be configured only where the application needs it.

See [`api/.env.example`](./api/.env.example) for the complete list with placeholders.

## 3. Deploy and smoke-test

```bash
curl -i https://YOUR-DEPLOYMENT-URL/api/health
curl -i https://YOUR-DEPLOYMENT-URL/api/admin/stats
curl -i https://YOUR-DEPLOYMENT-URL/api/memories/recent
curl -i https://YOUR-DEPLOYMENT-URL/api/community/submissions
```

Expected results:

- `/api/health`: HTTP 503 with `error_code: CONFIGURATION_INCOMPLETE` while required variables are missing; HTTP 200 with `success: true` once configured. This validates configuration only, not Supabase connectivity.
- `/api/admin/stats`: HTTP 401 without an admin key.
- Public reads return the same approved/public data as the current site.
- Test public submissions only against the staging database.
- Test admin approve/reject flows with a staging record and the configured admin key.
- Check browser Network and Console for failed requests, CSP errors, CORS failures, and 404s.
- Check a real memory URL with a normal browser user-agent and a crawler user-agent to verify the page and per-memory Open Graph tags.

Crawler requests to `/memory/:slug` are rewritten to `/api/memory-og/:slug` only when the `user-agent` matches the bot list in `vercel.json`; everyone else receives `/memory.html` from the static output. The function also re-checks the user-agent, so direct requests behave the same way.

## 4. Scheduled jobs

`vercel.json` declares two Cron jobs (UTC):

| Path | Schedule |
|---|---|
| `/api/cron/daily-feature-refresh` | `0 0 * * *` |
| `/api/cron/cleanup-automation` | `0 3 * * *` |

Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled invocations. `server/vercel-adapter.js` returns 503 when `CRON_SECRET` is unset and 401 when the secret does not match. To exercise a route manually:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR-DEPLOYMENT-URL/api/cron/cleanup-automation
```

Use staging credentials for manual runs because cleanup mutates data. The Hobby plan allows two Cron jobs, which is exactly what this project uses.

## 5. Netlify rollback

Netlify remains a working fallback:

- `netlify.toml` publishes the same `dist/` output and runs the same build command.
- `netlify/functions/*` are thin wrappers around the canonical `server/functions/*` handlers.
- `/api/*` redirects mirror every routed endpoint. `npm run guard:routes` fails if a route has no Netlify redirect.
- `npm run dev:netlify` starts the Netlify CLI locally; `npm run dev` starts Vercel.

Do not delete `netlify.toml`, `netlify/functions/`, or the Netlify CLI dependency until the Vercel production deployment has passed the checklist below.

## 6. Local validation

Run the same checks CI runs:

```bash
npm test
npm run lint
npm run lint:css
npm run build
node scripts/build-public.cjs --verify
npm run guard:migrations
npm run guard:routes
npm run guard:vercel
```

`guard:routes` verifies that every handler is reachable, every Netlify wrapper has a canonical implementation, cron paths exist, and Netlify redirects match the routed API surface. `guard:vercel` validates `vercel.json` (build wiring, function limits, headers, rewrites, cron schedules) and that no internal path can be published.

## 7. Production cutover checklist

- [ ] Main page and every clean URL load: `/poster`, `/dhikr-generator`, `/admin`, `/analytics`, `/community`, `/contact`, `/create-memory`, `/adhkar`, `/memories`, `/martyrs`, and a real `/memory/:slug`.
- [ ] Every API route has been checked for method, authorization, status code, and CORS behavior.
- [ ] Public submissions, community reads, memory interactions, feedback, and admin moderation work.
- [ ] Supabase secret-key access and publishable-key/RLS reads work as intended.
- [ ] Rate limiting and client-IP extraction work on Vercel.
- [ ] Both scheduled handlers reject unauthenticated requests and succeed with a valid `CRON_SECRET`.
- [ ] Analytics and optional GA4 features are verified or intentionally left unconfigured.
- [ ] Memory crawler metadata and service-worker/cache behavior are checked.
- [ ] Production environment variables are configured separately from Preview.
- [ ] A rollback plan for the custom domain/DNS is recorded.

Only after those checks should the production domain be assigned to Vercel and DNS changed. Verify the domain, TLS, API behavior, and scheduled jobs after cutover. Remove the Netlify fallback only after the Vercel production URL has been validated.

## 8. Database and secret safety

Do not apply migrations automatically as part of deployment. Review each SQL migration and apply the required ones to the intended Supabase environment. Do not print, commit, or share real secrets. Rotate any credential exposed in logs or source control.
