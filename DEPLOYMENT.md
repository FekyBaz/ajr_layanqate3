# Vercel Deployment Guide

This migration is intentionally staged. Deploy and validate `feat/vercel-migration` as a Preview first. Keep the current Netlify production deployment available until the Vercel Preview passes the full checklist and the domain is ready to move.

## 1. Create the Vercel project

1. Import `FekyBaz/ajr_layanqate3` from GitHub.
2. Use the repository root as the Root Directory.
3. Select the **Other** framework preset (static HTML/CSS/JS plus Vercel Functions).
4. Use Node.js 24, matching `.nvmrc` and the `engines.node` setting.
5. Do not assign the production domain or switch DNS during initial validation.
6. Ensure `feat/vercel-migration` creates a Preview deployment. Leave the existing main branch deployment and Netlify site unchanged.

## 2. Configure Preview environment variables

Use a development/staging Supabase project for Preview when possible. Do not point the Preview deployment at a production database until you have reviewed the impact of writes, rate limits, admin actions, and scheduled cleanup.

Required variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side secret; never prefix it with `NEXT_PUBLIC_` or expose it to the browser)
- `SUPABASE_ANON_KEY`
- `ADMIN_API_KEY`
- `FRONTEND_URL` (the primary site origin)
- `IP_SALT` (generate an independent random secret for Preview)
- `CRON_SECRET` (random secret of at least 16 characters)
- `ALLOWED_ORIGINS` if you need additional explicit origins
- Any rate-limit settings that you override
- Optional GA4 and Telegram variables if those features are to be tested

Vercel supplies `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL` when available. Do not copy values from another project. Add secrets in Vercel Project Settings → Environment Variables and make sure the environment selection is **Preview** for the first deployment.

## 3. Deploy and smoke-test Preview

Use the Preview URL and run the relevant tests:

```bash
curl -i https://YOUR-PREVIEW-URL/api/health
curl -i https://YOUR-PREVIEW-URL/api/admin/stats
curl -i https://YOUR-PREVIEW-URL/api/memories/recent
curl -i https://YOUR-PREVIEW-URL/api/community/submissions
```

Expected high-level results:

- `/api/health`: HTTP 200 and `success: true`.
- `/api/admin/stats`: HTTP 401 without an admin key.
- Public reads return the same approved/public data as the current site.
- Test a public submission only against the staging database.
- Test admin approve/reject flows with a staging record and the configured admin key.
- Check browser Network and Console for failed requests, CSP errors, CORS failures, and 404s.
- Check a real memory URL with a browser and a crawler user-agent to verify that the page and per-memory Open Graph tags work.
- Check that the current browser-side references no longer require `/.netlify/functions/*`.

Vercel Cron jobs are configured in `vercel.json` and are invoked by production deployments, not Preview deployments. To verify the route logic in Preview, call the relevant `/api/cron/*` route manually with `Authorization: Bearer <CRON_SECRET>`; use staging credentials because cleanup mutates data. Cron invocations without a valid secret are rejected.

## 4. Production cutover checklist

Do not remove the Netlify fallback until the Preview passes:

- [ ] Main page and every clean URL load.
- [ ] Every API route has been checked for correct method, authorization, status code, and CORS behavior.
- [ ] Public submissions, community reads, memory interactions, feedback, and admin moderation work.
- [ ] Supabase service-role access and anon/RLS reads work as intended.
- [ ] Rate limiting and IP extraction work on Vercel.
- [ ] Both scheduled handlers succeed when authenticated.
- [ ] Analytics and optional GA4 features are verified or intentionally left unconfigured.
- [ ] Memory crawler metadata and the service worker/cache behavior are checked.
- [ ] All required Production environment variables are configured separately.
- [ ] A rollback plan for the custom domain/DNS is recorded.

Only after those checks should the production domain be assigned to Vercel and DNS changed. Verify the domain, TLS, API behavior, and scheduled jobs after cutover. Remove `netlify.toml`, `netlify/functions/`, the Netlify CLI dependency, and any leftover Netlify-specific docs/references only after the Vercel production URL has been validated.

## 5. Database and secret safety

Do not apply migrations automatically as part of deployment. Review each SQL migration and apply the required ones to the intended Supabase environment. Do not print, commit, or share real secrets. Rotate any credential exposed in logs or source control.
