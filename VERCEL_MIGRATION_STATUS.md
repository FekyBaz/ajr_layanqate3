# Vercel Migration Status

Updated: 2026-10-16 (continuation)

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
| 4. Vercel Preview deployment | Blocked / not yet validated | The only observed Vercel deployment attempt failed before serving traffic with `BUILD_UTILS_NODE_VERSION_DISCONTINUED` because that deployment used Node.js 20. The branch was subsequently aligned to Node.js 24, but no successful Preview deployment has been observed. The deployment tool also reported the attempted target as `production`, not Preview, and subsequent project/settings reads returned HTTP 403 for the connected Vercel scope. Re-authenticate the intended Vercel account/project and verify Preview targeting before the next deployment. Do not add or copy secrets until the scope is confirmed. |

## Latest verified repository state

- Branch: `feat/vercel-migration`
- CI and Security & Validation passed on `9f36ffad38590e032a3d270d024e88334c336b99` after switching the workflow install steps to `npm ci`.
- Both workflows also passed on `38075967e3d673d51abfba2eef462f7501659aba` after the first migration status note was added.
- The runtime/lockfile commits are included in those tested heads; the failed Vercel deployment was created from an earlier Node.js 20 commit.

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
