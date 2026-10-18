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
| 1. Vercel route foundation | Code + CI checks complete | Added a catch-all API dispatcher plus the dedicated memory Open Graph handler. The 36 existing API endpoints are explicitly mapped in `server/vercel-router.js`; static tests verify all handlers are reachable. The latest build completed as `READY` with only two JavaScript files under `api/`, below the Hobby function-count cap. Live API behavior is not yet verified. |
| 2. Remove browser-side Netlify calls | Code + CI checks complete | Browser code uses same-origin `/api/*` for the previously missed Fatiha counter and community tree stats calls. Regression test rejects direct `/.netlify/functions/*` references in browser JS/HTML. |
| 3. Runtime and dependency alignment | Code + CI checks complete | Uses Node.js 24, removes the root `netlify-cli` development dependency, synchronizes `package-lock.json`, and validates the lock with `npm ci` in GitHub Actions. |
| 4. Vercel Preview deployment | Build ready; runtime validation blocked | Deployment `dpl_94PeaZjD2AJR47QAKXMimBMoYeth` reached `READY` from commit `d0107c8d29d8baf9da03121c7b6f3860764d5ce4` on `feat/vercel-migration`; `target` is null, not Production, and the alias is branch-specific. The initial Hobby-limit error has been addressed by reducing the function count to two. Runtime smoke tests are still blocked: Vercel denied the connected account's protection-bypass request with HTTP 403 for scope `mohamed-elfekys-projects`, and the general browser tool cannot reach the protected URL. Confirm/re-authorize the Vercel connection for the owning project, then inspect required Preview environment variables and run API smoke tests. Do not copy Production secrets or switch the domain before access and environment scope are verified. |

## Latest verified repository state

- Branch: `feat/vercel-migration`
- Latest code commit: `d0107c8d29d8baf9da03121c7b6f3860764d5ce4`.
- CI: passed on the latest code commit — [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/39081424104).
- Security & Validation: passed on the latest code commit — [run](https://github.com/FekyBaz/ajr_layanqate3/actions/runs/39081424121).
- Preview build: `READY` — deployment ID `dpl_94PeaZjD2AJR47QAKXMimBMoYeth`, [branch deployment URL](https://ajr-layanqate3-git-feat-vercel-d09185-mohamed-elfekys-projects.vercel.app).
- Code and build are verified; the API's live runtime behavior, required environment variables, and user-visible page load remain unverified because the connected Vercel authorization cannot read/bypass this project's deployment protection.

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
