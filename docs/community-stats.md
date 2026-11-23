# Community Statistics

This document defines every community metric, its source of truth, and how the
`community_stats` cache is kept fresh. It accompanies
`server/functions/utils/community-stats.js` and
`server/functions/community-submissions.js`.

## Source of truth

All community metrics are derived from `public.submissions` filtered to the
publicly visible statuses:

```sql
status IN ('Approved', 'Posted')
```

That set is defined once as `VISIBLE_STATUSES` in
`server/functions/utils/shared.js` and matches the public `SELECT` policy in
migration `007_expand_public_visible_statuses.sql`.

`public.community_stats` is a **single-row cache** (`id = 1`), not a second
source of truth.

## Metric definitions

| API field | SQL definition | Notes |
| --- | --- | --- |
| `stats.totalApproved` | `COUNT(*)` over visible submissions | Headline "approved shares" count. Reconciled with the live count on read. |
| `stats.totalPostCount` | `SUM(post_count)` over visible submissions | Total tracked shares (whatsapp/telegram/x/native). |
| `stats.averagePostCount` | `SUM(post_count) / COUNT(*)`, or `0` when the set is empty | Used by the community page to mark "trending" cards. |
| `stats.newApprovedToday` | `COUNT(*)` over visible submissions with `created_at >= start of the server day` | Computed live on every request; not cached. |
| `stats.goal.dailyTarget` | `community_goal.daily_target` | Admin-managed goal row. |
| `stats.goal.currentProgress` | `community_goal.current_progress` | Admin-managed goal row. |
| `pagination.total` | PostgREST `count=estimated` over the same visible set | Deliberately estimated to avoid full-table scans on a public endpoint. Exact for small/medium tables. |
| `pagination.totalPages` | `ceil(pagination.total / pageSize)`, minimum `1` | |
| `featured` | Visible submission with `post_count > 0`, ordered by `post_count DESC, created_at DESC`, limit 1 | |
| `dailyFeature` | Today's `daily_feature` row joined to its visible submission | Admin/cron managed. |

`pagination.total` is an estimate by design. `stats.totalApproved` is the exact
count after reconciliation; when the cache is cooling down or a refresh fails,
the API uses the same live count as pagination so the stat card and the list
never disagree.

## Writers

| Writer | What it updates |
| --- | --- |
| `refresh_community_stats()` (migration 012) | Recomputes `total_approved`, `total_post_count`, `average_post_count` from the visible set and upserts row `1`. Service-role only (migrations 012 and 015). |
| `increment_post_count()` (migration 025) | Adds `1` to `total_post_count` and bumps `updated_at` on each tracked share. It does **not** update `total_approved` or `average_post_count`. |

Because the incremental writer covers shares only, new approvals and the
average can drift from the table. The cache must therefore be periodically
recomputed.

## Refresh policy (lazy reconciliation)

`server/functions/utils/community-stats.js` wraps the cache with a reconciler:

1. Read `community_stats` through the **publishable** client (RLS stays the
   boundary).
2. Refresh through the existing **service-role** RPC when:
   - the row is missing, or
   - the cached `total_approved` differs from the live count, or
   - the TTL (`1 hour`) has elapsed since the last successful refresh.
3. Refuse to refresh more than once per `1 minute` cooldown per process.
4. De-duplicate concurrent refreshes in the same process with an in-flight
   promise.
5. If the refresh fails, log it and serve the cached snapshot with the live
   `totalApproved`; the request still succeeds.
6. If the row is missing and the refresh fails, reject so the handler's
   `degraded_fallback` path applies instead of publishing zeros.

The first request after a deployment that observes a stale count (for example
`78` cached vs `94` live) refreshes the row immediately. No cron job, secret,
schema, or RLS change is required.

### Why not Vercel Cron

- The repository targets the Vercel Hobby plan. `scripts/check-vercel.cjs`
  enforces **2 cron jobs maximum**, and both slots are already used by
  `daily-feature-refresh` and `cleanup-automation`. A third cron entry fails the
  guard and the deployment.
- Hobby Cron Jobs run **once per day at most**. An hourly refresh would fail
  deployment, and a daily refresh would still leave the cache stale for up to
  24 hours.
- `CRON_SECRET` exists and `scheduledHandlerToVercel` validates it, but
  `requireScheduledOrAdmin` currently accepts only the admin key. Marking
  `/api/community/stats-refresh` as `scheduled: true` would therefore break the
  existing admin-triggered refresh path unless a dual-auth wrapper were added.
- A cron job would also write even when nothing changed, whereas the lazy
  reconciler only writes when the cache is actually stale.

If the project moves to Pro, a cron entry can be added later as an extra safety
net; the lazy reconciler remains correct on its own.

## Write-conflict analysis

- `refresh_community_stats()` is a single `INSERT ... ON CONFLICT (id) DO UPDATE`
  computed from one aggregate snapshot. It is idempotent: concurrent refreshes
  converge to the same row instead of conflicting.
- The reconciler serializes refreshes within a process and backs off after a
  failure, so one slow or failing refresh cannot cause a retry storm.
- Known limitation: a share that commits between the RPC's aggregate read and
  its upsert can be transiently overwritten by the recomputed total. The next
  reconciliation heals it. Eliminating the window entirely requires a row lock
  (`FOR UPDATE`) inside `refresh_community_stats`, which is a schema change and
  is intentionally out of scope for this fix.
- The reconciler never writes from the public client. The RPC remains
  service-role only.

## Failure modes

| Failure | Behavior |
| --- | --- |
| `community_stats` read fails | Handler logs it and uses `degraded_fallback` with the live count. |
| Refresh RPC fails, cache exists | Request succeeds with cached shares/average and the live count; error is logged. |
| Refresh RPC fails, cache missing | `getSnapshot` rejects; handler uses `degraded_fallback` with the live count. |
| Refresh returns malformed data | Treated as a failed refresh; cached values are served. |
| Concurrent requests see the same drift | One refresh is shared; the rest use its result. |

## Verification

- Unit tests: `tests/community-stats.test.js` (mapping, drift, TTL, cooldown,
  in-flight de-duplication, malformed payload, failure fallback).
- Handler tests: `tests/community-submissions.test.js` (stale reconciliation,
  no unnecessary refresh, failure fallback, missing-row rebuild, key separation).
- No production writes are performed by the test suite; Supabase is mocked.
