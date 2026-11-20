# Privacy Notice — أجر لا ينقطع

This document describes what the current code actually collects, so operators
can configure a deployment according to applicable privacy requirements.

## Custom analytics (`lib/analytics.js` → `/api/analytics`)

Collected per event (see `lib/analytics.js`):

- `page_path`, `page_title`, `referrer`
- UTM parameters (`utm_source/medium/campaign/content/term`)
- Device info derived locally: `deviceType` (desktop/mobile/tablet), `language`
- Pseudonymous `session_id` (random, kept in `sessionStorage`)
- `ajr_returning=1` cookie (`max-age=31536000`, `path=/`, `SameSite=Lax`) marking repeat visits

What is NOT collected: IPs are not stored with custom analytics events, and no
names, emails, or message contents are sent to analytics.

## Server-side rate limiting and operational logs

The submission backend derives a salted, truncated hash of the client IP for
rate-limit/abuse-prevention records; it does not need the raw IP address in its
application log messages. The application log for the submission RPC records
operational rate-limit settings only, not the raw IP or its derived hash.
This hash is pseudonymous, not anonymous.

The hosting platform may separately process connection metadata in its
infrastructure/security logs. Operators should review the provider's privacy
terms, access controls, and retention settings rather than assuming those
platform logs are covered by this application's custom analytics behavior.

Retention/cleanup for `analytics_events` is operator-managed in Supabase
(no automatic purge job ships with this repo — configure retention yourself).

## Google Analytics 4 (optional, `lib/ga4.js`)

Loaded only when the deployment sets `GA_MEASUREMENT_ID` (served via
`/api/ga-config`). When unset, no Google request is made. GA4 collection
follows Google's terms; server-side GA4 dashboard access additionally needs
`GA4_PROPERTY_ID` plus a service-account or OAuth credential set.

## Opting out / disabling

- End users: every page shows a one-time consent banner (`lib/consent.js`,
  no trackers run before you choose). Accept enables anonymous analytics,
  decline calls `AjrAnalytics.optOut()` (also clearing the repeat-visitor
  cookie). Your choice is remembered; Do-Not-Track skips the banner entirely
  and disables both trackers. You can also toggle later in the console:
  `AjrAnalytics.optOut()` / `AjrAnalytics.optIn()` / `AjrAnalytics.isOptedOut()`.
- Private browsing / cookie blocking also works (the tracker degrades to
  memory-only sessions).
- Operators: to run without analytics, do not set `GA_MEASUREMENT_ID` and
  remove the `lib/analytics.js` script tags from the pages you serve.

## Reporting concerns

Do not open a public issue with personal data. See `SECURITY.md` for
private contact paths.
