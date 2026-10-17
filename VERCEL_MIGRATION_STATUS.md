# Vercel Migration Status

Updated: 2026-10-17

## Safety boundary

- All migration work belongs on `feat/vercel-migration`.
- `main` is unchanged by this migration work.
- Keep the current Netlify production deployment and `netlify/` source as the rollback path.
- Do not move a custom domain, change DNS, or remove Netlify configuration until the Vercel Preview passes the full validation checklist in [DEPLOYMENT.md](./DEPLOYMENT.md).
- Do not apply database migrations automatically during deployment.

## Phase status

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 1. Vercel route foundation | Code + CI checks complete | Added `api/` route adapters, shared handler adapter, Vercel routing/security config, Cron route definitions, and memory crawler metadata route. Code-level route mapping checks pass; live API behavior is not yet verified. |
| 2. Remove browser-side Netlify calls | Code + CI checks complete | Browser code uses same-origin `/api/*` for the previously missed Fatiha counter and community tree stats calls. Regression test rejects direct `/.netlify/functions/*` references in browser JS/HTML. |
| 3. Runtime and dependency alignment | Code + CI checks complete | Uses Node.js 24, removes the root `netlify-cli` development dependency, synchronizes `package-lock.json`, and validates the lock with `npm ci` in GitHub Actions. |
| 4. Vercel Preview deployment | Blocked / not yet validated | No successful Preview deployment has been verified. Deployment `dpl_9hqasRf5XSf3UymKggXkqDUyU93N` failed with `BUILD_UTILS_NODE_VERSION_DISCONTINUED` on an older Node.js 20 commit and was reported with target `production`. Our first direct deployment request also passed `target=preview`, which is not one of that tool's supported target values (`staging`, `production`, or a custom environment identifier); the API returned a Production-target attempt, so do not repeat that request shape. Later project metadata identified a newer deployment, `dpl_8udVSfTovawCfmPwjm7d1m2AUANJ`, as `ERROR` with target `staging`; detailed diagnostics could not be retrieved because the connected Vercel scope returned HTTP 403. Re-authenticate the intended Vercel account/project, inspect the latest failed deployment, and use the Git branch Preview workflow (with `main` confirmed as the production branch) or a correctly configured custom staging environment. Do not add or copy secrets until account/scope and target are confirmed. |

## Latest verified repository state

- Branch: `feat/vercel-migration`
- CI: passed on `7eb6fcf33284a5826cd191f9edd8c87a8a6cb7fe` — [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/38943091283).
- Security & Validation: passed on `7eb6fcf33284a5826cd191f9edd8c87a8a6cb7fe` — [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/38943091307).
- The Node.js 24 runtime alignment, lockfile cleanup, and `npm ci` workflow changes are included in the verified branch history. The earlier production-target failure was created from a Node.js 20 commit.

## Preview acceptance checks

Before considering the migration functional, deploy this branch as a genuine Preview and verify:

1. Main page and every clean URL, including `/poster`, `/admin`, `/analytics`, `/contact`, `/memories`, `/martyrs`, and a real `/memory/:slug`.
2. `GET /api/health` returns HTTP 200 with the expected success payload.
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
