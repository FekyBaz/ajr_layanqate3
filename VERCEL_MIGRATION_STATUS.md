# Vercel Migration Status

Updated: 2026-10-22

## Safety boundary

- All migration work belongs on `feat/vercel-migration`.
- `main` is unchanged by this migration work.
- Keep the current Netlify production deployment and `netlify/` source as the rollback path.
- Do not move a custom domain, change DNS, or remove Netlify configuration until the Vercel Preview passes the full validation checklist in [DEPLOYMENT.md](./DEPLOYMENT.md).
- Do not apply database migrations automatically during deployment.

## Phase status

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 1. Vercel route foundation | Code + CI checks complete | Added a catch-all API dispatcher, a lightweight standalone `/api/health` configuration check, and the dedicated memory Open Graph handler. The 35 business API routes remain explicitly mapped in `server/vercel-router.js`; static tests validate all mappings. The Vercel deployment exposes three JavaScript function entry points under `api/`, below the Hobby plan limit. |
| 2. Remove browser-side Netlify calls | Code + CI checks complete | Browser code uses same-origin `/api/*` for the previously missed Fatiha counter and community tree stats calls. Regression test rejects direct `/.netlify/functions/*` references in browser JS/HTML. |
| 3. Runtime and dependency alignment | Code + CI checks complete | Uses Node.js 24, removes the root `netlify-cli` development dependency, synchronizes `package-lock.json`, and validates the lock with `npm ci` in GitHub Actions. |
| 4. Vercel Preview deployment | Build ready; runtime validation blocked | Latest deployment `dpl_BNjc7YMTrq9qZRxdiFG7DWaAMLza` reached `READY` from code commit `fc802c42f8e6f93245280e90371d61e0816ea3a8` on `feat/vercel-migration`, with no Production target and no custom domain cutover. The project currently has only four Preview variables: `FRONTEND_URL`, `ALLOWED_ORIGINS`, `CRON_SECRET`, and `IP_SALT`; the latter two are now `sensitive` and have no Vercel security warnings. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and an admin key are still missing, so `/api/health` should return `503 CONFIGURATION_INCOMPLETE` and business API routes cannot be validated. The Vercel project also reports that it is not connected to a Git repository, so pushes will not auto-deploy. The connected Vercel tool cannot bypass project SSO protection or read runtime logs (HTTP 403); keep protection enabled and do not change DNS. Add the real staging credentials in Vercel, link the Git repository through Project Settings → Git (or create a separate Git-linked migration project if the existing one cannot be connected), then test all routes from an authorized session. |

## Latest verified repository state

- Branch: `feat/vercel-migration`
- Latest code commit: `fc802c42f8e6f93245280e90371d61e0816ea3a8`.
- CI: passed on the latest code commit — [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/39683149459).
- Security & Validation: passed on the latest code commit — [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/39683149630).
- Latest Preview build: `READY` — deployment ID `dpl_BNjc7YMTrq9qZRxdiFG7DWaAMLza`, [branch deployment URL](https://ajr-layanqate3-git-feat-vercel-d09185-mohamed-elfekys-projects.vercel.app).
- All required environment-variable keys are not yet configured. Direct testing of the page/API from this session remains blocked by Vercel Deployment Protection returning HTTP 403; this is an authorization issue, not proof that the HTTP handlers are healthy.

## Preview acceptance checks

Before considering the migration functional, deploy this branch as a genuine Preview and verify:

1. Main page and every clean URL, including `/poster`, `/admin`, `/analytics`, `/contact`, `/memories`, `/martyrs`, and a real `/memory/:slug`.
2. `GET /api/health` must return HTTP 503 with `CONFIGURATION_INCOMPLETE` while required variables are missing; once configured it should return HTTP 200 with `success: true` (configuration readiness only, not a Supabase connectivity check).
3. Protected admin routes reject requests without credentials.
4. Community submissions, approved memory reads, Fatiha counter, contact, analytics as configured, and other expected methods/status codes behave correctly.
5. Create or update test data only in a staging Supabase project; verify service-role and anon/RLS access separately.
6. Both Cron handlers reject unauthenticated requests and complete only with a valid `CRON_SECRET`; scheduled execution itself must be confirmed on the production configuration before cutover.
7. Browser Console and Network have no unexpected 404s, CORS/CSP failures, or stale service-worker behavior.
8. Check memory Open Graph metadata using both a normal browser user-agent and a crawler user-agent.
9. Configure Production environment variables separately and record how to roll the domain/DNS back.

## Final cutover

Only after every Preview check succeeds:
- configure the intended production branch and production environment;
- assign the custom domain to Vercel and verify TLS and API behavior;
- keep Netlify available until post-cutover checks pass;
- then remove `netlify.toml`, `netlify/functions/`, the Netlify-specific workflow validation, and any remaining Netlify-only references in a final cleanup commit.
