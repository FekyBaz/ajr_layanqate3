# Vercel Migration and Runtime-Portability Status

Updated: 2026-10-26 (runtime-neutral refactor committed; CI passed on commit 6590a0601e89675c93a94e6954d1877ccf3dc480)

## Safety boundary

- The current runtime-portability work is isolated on `feat/runtime-neutral-backend`, based on `feat/vercel-migration`.
- `main` and the parent `feat/vercel-migration` branch have not been changed by this refactor.
- Keep the current Netlify production deployment and its configuration as the rollback path.
- Do not move a custom domain, change DNS, remove Netlify configuration, or apply database migrations automatically during deployment.

## Phase status

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 1. Vercel route foundation | Previously implemented on the parent migration branch | The catch-all dispatcher, standalone `/api/health` configuration check, dedicated memory Open Graph handler, and 35 explicit business API routes remain in place. The parent branch's CI previously passed on commit `539d96c1a0eb9469ed6ee9c004dff05a1c0577fc`; the new branch's CI passed on head commit `6590a0601e89675c93a94e6954d1877ccf3dc480` — [CI](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/40243519017), [Security & Validation](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/40243518992). |
| 2. Shared backend and runtime adapters | Code committed; CI passed | The 35 routed business handlers live canonically under `server/functions/`. Netlify's corresponding entry points are thin wrappers that normalize the incoming request and call those same handlers. Netlify- and Vercel-specific client IP/country headers are normalized by their respective adapters; shared handler logic consumes `clientIP` and `clientCountry`, not vendor headers. Shared CORS logic consumes a provider-neutral deployment-origin configuration. The CI test, lint, migration guard, secret scanning, syntax, security pattern scan, dependency audit, and Netlify configuration checks passed on head commit `6590a0601e89675c93a94e6954d1877ccf3dc480`. |
| 3. Runtime alignment | Code updated; CI passed on the latest verified head | `.nvmrc`, `package.json`, CI policy, and `netlify.toml` are aligned on Node.js 24 for this branch. The manifest/lockfile had been synchronized on the parent migration branch, but this branch is still behind `main`'s latest dependency-only commits: `@supabase/supabase-js` and `google-auth-library` need reconciliation before the final merge. |
| 4. Vercel Preview runtime validation | Blocked; no new branch deployment verified | The previously observed Preview belongs to the parent migration branch, not this runtime-neutral branch. Its deployment ID was `dpl_FmW6uz6XchJWrsSfYJnajLHgRNkG` and its build reached `READY`, but the Preview environment lacked `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and an admin key. Vercel Deployment Protection also returned HTTP 403 from the connected session. That older build is not evidence that the new branch's runtime handlers work. Keep protection enabled and do not change DNS. |

## Branch and CI evidence

- Work branch: `feat/runtime-neutral-backend`.
- Latest fully checked head at report update: `6590a0601e89675c93a94e6954d1877ccf3dc480`.
- CI: [passed](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/40243519017).
- Security & Validation: [passed](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/40243518992).
- The original migration branch was 19 commits ahead of `main` and 3 commits behind it when this refactor began; reconcile the dependency updates before merging to `main`.
- Prior migration baseline CI: [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/39684479688).
- Prior migration baseline Security & Validation: [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/39684479455).
- Prior Preview: [branch deployment URL](https://ajr-layanqate3-git-feat-vercel-d09185-mohamed-elfekys-projects.vercel.app). It does not contain the runtime-neutral refactor.
- CI and Security & Validation both passed on the current branch head `0120961c11368a6869d41e0ce07cb12c1b63a06f`: [CI](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/40243579756), [Security & Validation](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/40243579816). The Vercel Preview configuration, Supabase connectivity, and reachability from Egyptian networks remain outstanding.

## Preview acceptance checks

Before considering the migration functional, deploy the runtime-neutral branch as a genuine Preview and verify:

1. Main page and every clean URL, including `/poster`, `/admin`, `/analytics`, `/contact`, `/memories`, `/martyrs`, and a real `/memory/:slug`.
2. `GET /api/health` returns HTTP 503 with `CONFIGURATION_INCOMPLETE` while required variables are missing; once configured it returns HTTP 200 with `success: true`. This confirms configuration readiness only, not Supabase connectivity.
3. Protected admin routes reject requests without credentials.
4. Community submissions, approved memory reads, Fatiha counter, contact, analytics, and other expected methods/status codes behave correctly.
5. Create or update test data only in a staging Supabase project; verify service-role and anon/RLS access separately.
6. Both Cron handlers reject unauthenticated requests and complete only with a valid `CRON_SECRET`; confirm scheduled execution separately on production configuration before cutover.
7. Browser Console and Network have no unexpected 404s, CORS/CSP failures, or stale service-worker behavior.
8. Check memory Open Graph metadata with both a normal browser user-agent and a crawler user-agent.
9. Configure Production environment variables separately and record how to roll the domain/DNS back.
10. Confirm both Netlify and Vercel invoke the canonical `server/functions/` handlers and that provider headers are normalized only by the relevant adapter.

## Final cutover

Only after every Preview check succeeds:

- configure the intended production branch and production environment;
- assign the custom domain to Vercel and verify TLS and API behavior;
- keep Netlify available until post-cutover checks pass;
- then remove `netlify.toml`, `netlify/functions/`, Netlify-only workflow validation, and remaining Netlify-only references in a final cleanup commit.
