# Safe local smoke-test checklist

Use this checklist before opening a pull request that affects the frontend, serverless functions, deployment, authentication, or database access.

## Safety rules

- Use Node.js 22.13.0 or later (the repository's `.nvmrc` selects Node 22).
- Use a dedicated development/test Supabase project with synthetic content. Do not test write paths against production.
- Copy placeholders from `api/.env.example` to a local `.env`, then enter credentials for the test project only. Never commit `.env`, service-role keys, admin keys, tokens, or production exports.
- A smoke test must not require a real user's personal information. Use clearly synthetic names/content such as `SMOKE-TEST-2026-10-25`.
- Do not run approval/rejection, migration, destructive cleanup, or successful submission tests against production.

## 1. Clean install and automated checks

From the repository root:

```bash
npm ci
npm run build
node scripts/build-public.cjs --verify
npm test
npm run lint
npm run lint:css
npm run guard:migrations
```

Expected results:
- Dependency installation completes from the lockfile.
- The build creates `dist/` from the explicit public-file allowlist.
- The artifact verifier reports no missing public files and no unexpected paths.
- Tests, ESLint, Stylelint, and the migration guard exit successfully.

Before opening a pull request, review `git status --short` and make sure no local `.env`, test export, generated database data, or credential file is staged.

## 2. Start the local application

Create `.env` from `api/.env.example` and fill it with values from the dedicated test project. Ensure `IP_SALT` and an independently generated `ADMIN_API_KEY` are set for local use.

Start Netlify Dev:

```bash
npm run dev
```

Use the URL printed by the CLI (typically `http://localhost:8888`). Do not expose the local server to the public internet.

## 3. Read-only HTTP smoke checks

Run these against the local server, not production:

```bash
curl -i http://localhost:8888/api/health
curl -i http://localhost:8888/sitemap.xml
curl -i http://localhost:8888/api/admin/stats
```

Check:
- `/api/health` returns HTTP 200 with JSON containing `"status":"ok"`.
- `/sitemap.xml` returns HTTP 200 with XML content.
- `/api/admin/stats` without an admin credential returns HTTP 401 (or the expected unauthenticated error envelope); it must not return protected statistics.

For Windows PowerShell, the same endpoints can be checked with:

```powershell
(Invoke-WebRequest -Uri 'http://localhost:8888/api/health').StatusCode
(Invoke-WebRequest -Uri 'http://localhost:8888/sitemap.xml').StatusCode
try {
  Invoke-WebRequest -Uri 'http://localhost:8888/api/admin/stats'
  throw 'Expected the unauthenticated admin request to fail'
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw }
}
```

## 4. Browser and route checks

Open the local site and check these routes:
- `/` and `/community.html`
- `/adhkar.html`
- `/memories` and a memory page opened from the list
- `/create-memory`
- `/poster.html`
- `/martyrs`
- `/contact`

For each route, verify:
- The page loads and the intended content appears.
- Styles, images, and scripts load without unexpected 404 errors in the browser Network panel.
- No uncaught exceptions appear in the console.
- Keyboard focus is visible and primary actions work on desktop and a narrow/mobile viewport.
- Arabic text is readable and the RTL layout does not overflow horizontally.

## 5. Write-flow checks — test project only

Only perform these checks when using a separate disposable Supabase project:
1. Submit one synthetic item through the public submission form.
2. Confirm it enters the pending-review workflow and is not public before approval.
3. Open the admin interface and verify that access without the configured admin key is denied.
4. Approve or reject the synthetic item using the intended moderation flow and verify the resulting state.
5. Confirm rate limiting and validation reject invalid input as expected.
6. Remove test records through the supported test-project cleanup process when appropriate.

Never include admin credentials in URLs, screenshots, issue comments, or browser console output. Do not print service-role keys or entire environment objects while debugging.

## 6. Publish-boundary verification

The static site should publish from `dist/`, not from the repository root. Confirm the artifact contains required public pages/assets and does **not** contain `.github/`, `api/migrations/`, `netlify/functions/`, `prototypes/`, `tests/`, package manifests, or local environment files. The automated build test checks the allowlist; do not replace the allowlist with a broad copy of the repository.

After a release, a maintainer should separately verify the deployed site's public routes and that internal paths are not downloadable. CI alone does not prove the production site's current deploy configuration.

## Report failures

In the pull request, record which command/route failed, the expected versus actual result, the runtime version, and whether the failure reproduces on a clean install. Redact credentials, personal data, IP addresses, and private database contents. For security vulnerabilities, follow `SECURITY.md` instead of opening a public issue with exploitable details.
