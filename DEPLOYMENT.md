# Deployment Guide

## Supported deployment target

The current repository is configured for **Netlify**. Older Vercel instructions have been removed because they no longer match the active project configuration.

## 1. Prepare Supabase

1. Create a Supabase project.
2. Review the SQL migrations in this repository.
3. Apply the migrations required by the current application.
4. Configure Row Level Security according to the application's current data-access model.
5. Keep the Supabase service-role key server-side only.

Do not copy credentials from an existing production project into this repository.

## 2. Create the Netlify site

Import the GitHub repository into Netlify.

Use the repository's existing `netlify.toml` as the source of deployment configuration. Do not add Vercel-specific configuration unless the deployment architecture is intentionally changed.

## 3. Configure environment variables

Set the required variables in Netlify's environment-variable settings.

At minimum, review:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (if required by the current functions)
- `ADMIN_API_KEY`
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`
- Rate-limit variables
- `IP_SALT`
- Optional `GA_MEASUREMENT_ID`

Generate production secrets independently. Never reuse example values.

## 4. Deploy

Trigger the first deploy and verify:

- The site loads.
- `/api/health` responds as expected.
- Public submissions work.
- Admin authentication works.
- Admin review actions work.
- Rate limiting is active.
- Database writes reach the intended Supabase project.

## 5. Production checklist

- [ ] No secrets exist in tracked files.
- [ ] Production environment variables are configured only in Netlify/Supabase.
- [ ] CORS allows only the intended origins.
- [ ] Admin credentials have been rotated from any development values.
- [ ] Supabase RLS and policies have been reviewed.
- [ ] Database backups/recovery expectations are understood.
- [ ] Analytics configuration matches the published privacy notice.
- [ ] Third-party assets have redistribution rights.
- [ ] The deployment URL and any public identifiers are safe to disclose.
