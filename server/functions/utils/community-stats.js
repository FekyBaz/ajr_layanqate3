/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Community statistics reconciliation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Source of truth: public.submissions WHERE status IN ('Approved', 'Posted')
 * — the same visibility set used by the public RLS policy (migration 007) and
 * by VISIBLE_STATUSES in shared.js.
 *
 * Metric definitions:
 * - totalApproved   = COUNT(*) of visible submissions.
 * - totalPostCount  = SUM(post_count) over visible submissions.
 * - averagePostCount = SUM(post_count) / COUNT(*) over visible submissions
 *                      (0 when there are no visible submissions).
 *
 * public.community_stats is a single-row cache (id = 1). It is written by:
 * - refresh_community_stats() (migration 012): recomputes all three metrics
 *   from the visibility set and upserts row 1 atomically.
 * - increment_post_count() (migration 025): adds 1 to total_post_count and
 *   bumps updated_at on every tracked share.
 *
 * The incremental writer does not cover new approvals or average_post_count,
 * so the cache can drift. This module reconciles it lazily on read:
 * - immediately when the cached approval count differs from the live count;
 * - periodically (TTL) to refresh shares/average;
 * - at most once per cooldown window per process;
 * - with in-flight de-duplication so concurrent requests share one refresh.
 *
 * The refresh is an idempotent single-row upsert computed from the same
 * visibility set, so concurrent refreshes converge instead of conflicting.
 * When a refresh is skipped or fails, the caller receives the live count, so a
 * stale cache can never understate the headline number.
 *
 * Known limitation: a share that commits between the refresh's aggregate read
 * and its upsert can be transiently overwritten by the recomputed total. The
 * next reconciliation heals it; eliminating the window entirely would require
 * a row lock (FOR UPDATE) inside refresh_community_stats, which is a schema
 * change and intentionally out of scope here.
 */

export const STATS_REFRESH_TTL_MS = 60 * 60 * 1000;
export const STATS_REFRESH_COOLDOWN_MS = 60 * 1000;

function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toNonNegativeNumber(value) {
    return Math.max(toFiniteNumber(value), 0);
}

/**
 * Map a community_stats row (snake_case) to the API's camelCase shape.
 * Returns null when the row is absent so callers can trigger the RPC fallback.
 */
export function mapStatsRow(row) {
    if (!row || typeof row !== 'object') return null;

    return {
        totalApproved: toNonNegativeNumber(row.total_approved),
        totalPostCount: toNonNegativeNumber(row.total_post_count),
        averagePostCount: toNonNegativeNumber(row.average_post_count),
        updatedAt: row.updated_at || null,
    };
}

/**
 * Map the jsonb payload returned by refresh_community_stats().
 * Throws on a malformed payload so the caller can fall back to the cache
 * instead of publishing zeroed statistics.
 */
export function mapRefreshResult(data) {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
        throw new TypeError('refresh_community_stats returned no statistics');
    }

    return {
        totalApproved: toNonNegativeNumber(row.total_approved),
        totalPostCount: toNonNegativeNumber(row.total_post_count),
        averagePostCount: toNonNegativeNumber(row.average_post_count),
        updatedAt: new Date().toISOString(),
    };
}

function assertValidStats(stats) {
    if (!stats || !Number.isFinite(stats.totalApproved) || stats.totalApproved < 0) {
        throw new TypeError('refresh_community_stats returned invalid statistics');
    }
    return stats;
}

/**
 * Build a reconciler around the existing cache and RPC.
 *
 * @param {object} options
 * @param {() => Promise<object|null>} options.readCached Reads community_stats.
 * @param {() => Promise<object>} options.refresh Calls refresh_community_stats.
 * @param {{error: Function}} [options.logger]
 * @param {number} [options.cooldownMs] Minimum gap between refresh attempts.
 * @param {number} [options.ttlMs] Maximum cache age before a proactive refresh.
 * @param {() => number} [options.now] Injectable clock for tests.
 */
export function createStatsReconciler({
    readCached,
    refresh,
    logger = console,
    cooldownMs = STATS_REFRESH_COOLDOWN_MS,
    ttlMs = STATS_REFRESH_TTL_MS,
    now = () => Date.now(),
} = {}) {
    if (typeof readCached !== 'function' || typeof refresh !== 'function') {
        throw new TypeError('createStatsReconciler requires readCached and refresh functions');
    }

    let inFlight = null;
    let lastAttemptAt = Number.NEGATIVE_INFINITY;
    let lastSuccessAt = now();
    let lastReconciledLiveTotal = null;

    function runRefresh() {
        if (inFlight) return inFlight;

        inFlight = (async () => {
            try {
                const fresh = assertValidStats(await refresh());
                lastSuccessAt = now();
                return fresh;
            } finally {
                lastAttemptAt = now();
                inFlight = null;
            }
        })();

        return inFlight;
    }

    async function getSnapshot({ liveTotal } = {}) {
        const cached = await readCached();
        const hasLiveTotal = Number.isFinite(liveTotal);
        const cooldownElapsed = now() - lastAttemptAt >= cooldownMs;

        if (!cached) {
            if (!cooldownElapsed) {
                throw new Error('Community statistics are unavailable and the refresh is cooling down');
            }

            const fresh = await runRefresh();
            lastReconciledLiveTotal = hasLiveTotal ? liveTotal : null;
            return { stats: { ...fresh }, source: 'fallback', refreshed: true };
        }

        // Do not refresh twice for the same observed live count: if the RPC's
        // exact count differs from the estimated pagination count, re-running
        // the RPC would not change the outcome.
        const alreadyReconciled = hasLiveTotal && liveTotal === lastReconciledLiveTotal;
        const drift = hasLiveTotal &&
            cached.totalApproved !== liveTotal &&
            !alreadyReconciled;
        const ttlDue = now() - lastSuccessAt >= ttlMs;

        if ((drift || ttlDue) && cooldownElapsed) {
            try {
                const fresh = await runRefresh();
                lastReconciledLiveTotal = hasLiveTotal ? liveTotal : null;
                return { stats: { ...fresh }, source: 'table', refreshed: true };
            } catch (err) {
                logger.error(
                    'Community stats refresh failed; serving the cached snapshot:',
                    err?.message || err,
                );
            }
        }

        return {
            stats: {
                ...cached,
                // Only override with the live count when the cache has not
                // already been reconciled for this observed count. This keeps
                // the exact RPC value after a successful refresh while still
                // preventing a stale low count during cooldown or failure.
                totalApproved: hasLiveTotal && !alreadyReconciled
                    ? liveTotal
                    : cached.totalApproved,
            },
            source: 'table',
            refreshed: false,
        };
    }

    /**
     * Test-only hook: clear in-process cooldown/de-duplication state.
     * Production code never calls this.
     */
    function reset() {
        inFlight = null;
        lastAttemptAt = Number.NEGATIVE_INFINITY;
        lastSuccessAt = now();
        lastReconciledLiveTotal = null;
    }

    return { getSnapshot, reset };
}
