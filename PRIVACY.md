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

What is NOT collected: IPs are not stored with events, no names, emails, or
message contents are sent to analytics.

Retention/cleanup for `analytics_events` is operator-managed in Supabase
(no automatic purge job ships with this repo — configure retention yourself).

## Google Analytics 4 (optional, `lib/ga4.js`)

Loaded only when the deployment sets `GA_MEASUREMENT_ID` (served via
`/api/ga-config`). When unset, no Google request is made. GA4 collection
follows Google's terms; server-side GA4 dashboard access additionally needs
`GA4_PROPERTY_ID` plus a service-account or OAuth credential set.

## Opting out / disabling

- End users: block third-party/cookie storage, use private browsing, or enable
  Do-Not-Track (note: the current tracker does not yet gate on DNT — a
  consent banner + DNT respect is a wanted contribution, see issue #82).
- Operators: to run without analytics, do not set `GA_MEASUREMENT_ID` and
  remove the `lib/analytics.js` script tags from the pages you serve.

## Reporting concerns

Do not open a public issue with personal data. See `SECURITY.md` for
private contact paths.
