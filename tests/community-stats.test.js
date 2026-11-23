import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createStatsReconciler,
    mapRefreshResult,
    mapStatsRow,
    STATS_REFRESH_COOLDOWN_MS,
    STATS_REFRESH_TTL_MS,
} from '../server/functions/utils/community-stats.js';

const CACHED = Object.freeze({
    totalApproved: 78,
    totalPostCount: 219,
    averagePostCount: 2.782051282051282,
    updatedAt: '2026-05-22T20:14:24.559175+00:00',
});

const FRESH = Object.freeze({
    totalApproved: 94,
    totalPostCount: 235,
    averagePostCount: 2.5,
    updatedAt: '2026-11-23T00:00:00.000Z',
});

function silentLogger() {
    const messages = [];
    return {
        messages,
        error: (...args) => messages.push(args.map(String).join(' ')),
    };
}

test('mapStatsRow converts the cached row into the API shape', () => {
    assert.deepEqual(mapStatsRow({
        total_approved: '94',
        total_post_count: '235',
        average_post_count: '2.5',
        updated_at: '2026-11-23T00:00:00.000Z',
    }), FRESH);

    assert.equal(mapStatsRow(null), null);
    assert.equal(mapStatsRow(undefined), null);
});

test('mapRefreshResult accepts the RPC jsonb payload and rejects an empty one', () => {
    const mapped = mapRefreshResult({
        total_approved: 94,
        total_post_count: 235,
        average_post_count: 2.5,
    });

    assert.equal(mapped.totalApproved, 94);
    assert.equal(mapped.totalPostCount, 235);
    assert.equal(mapped.averagePostCount, 2.5);
    assert.ok(mapped.updatedAt);

    assert.throws(() => mapRefreshResult(null), /no statistics/);
});

test('a matching cache inside the TTL is served without a refresh', async () => {
    let refreshes = 0;
    const reconciler = createStatsReconciler({
        readCached: async () => ({ ...CACHED, totalApproved: 94 }),
        refresh: async () => { refreshes += 1; return FRESH; },
        logger: silentLogger(),
        now: () => 0,
    });

    const snapshot = await reconciler.getSnapshot({ liveTotal: 94 });

    assert.equal(refreshes, 0);
    assert.equal(snapshot.refreshed, false);
    assert.equal(snapshot.stats.totalApproved, 94);
    assert.equal(snapshot.stats.totalPostCount, 219);
});

test('a stale approval count triggers one exact reconciliation', async () => {
    let refreshes = 0;
    const reconciler = createStatsReconciler({
        readCached: async () => CACHED,
        refresh: async () => { refreshes += 1; return FRESH; },
        logger: silentLogger(),
        now: () => 0,
    });

    const snapshot = await reconciler.getSnapshot({ liveTotal: 94 });

    assert.equal(refreshes, 1);
    assert.equal(snapshot.refreshed, true);
    assert.equal(snapshot.source, 'table');
    assert.deepEqual(snapshot.stats, FRESH);
});

test('the same observed live count is not reconciled twice when the RPC differs by an estimate', async () => {
    let refreshes = 0;
    let now = 0;
    const reconciler = createStatsReconciler({
        readCached: async () => ({ ...CACHED, totalApproved: 94 }),
        refresh: async () => { refreshes += 1; return FRESH; },
        logger: silentLogger(),
        now: () => now,
    });

    const first = await reconciler.getSnapshot({ liveTotal: 95 });
    assert.equal(refreshes, 1);
    assert.equal(first.refreshed, true);

    // The cache still says 94 while the estimate says 95. The reconciler
    // already refreshed for liveTotal=95, so it must not loop, and it serves
    // the exact RPC value rather than the estimate.
    now = STATS_REFRESH_COOLDOWN_MS + 1;
    const second = await reconciler.getSnapshot({ liveTotal: 95 });
    assert.equal(refreshes, 1);
    assert.equal(second.refreshed, false);
    assert.equal(second.stats.totalApproved, 94);

    // A genuinely new count does trigger a new reconciliation.
    const third = await reconciler.getSnapshot({ liveTotal: 96 });
    assert.equal(refreshes, 2);
    assert.equal(third.refreshed, true);
});

test('TTL triggers reconciliation even when estimated count keeps returning the locked-out total', async () => {
    let refreshes = 0;
    let now = 0;
    // RPC returns 94, but pagination estimated count always returns 95.
    const reconciler = createStatsReconciler({
        readCached: async () => ({ ...CACHED, totalApproved: 94 }),
        refresh: async () => { refreshes += 1; return FRESH; },
        logger: silentLogger(),
        now: () => now,
    });

    // Initial reconciliation for liveTotal: 95
    await reconciler.getSnapshot({ liveTotal: 95 });
    assert.equal(refreshes, 1);

    // Within TTL and after cooldown, drift lockout prevents redundant refresh for same 95
    now = STATS_REFRESH_COOLDOWN_MS + 10;
    const second = await reconciler.getSnapshot({ liveTotal: 95 });
    assert.equal(refreshes, 1);
    assert.equal(second.refreshed, false);
    assert.equal(second.stats.totalApproved, 94);

    // After TTL expires, TTL triggers reconciliation even though liveTotal is still 95
    now = STATS_REFRESH_TTL_MS + 1;
    const third = await reconciler.getSnapshot({ liveTotal: 95 });
    assert.equal(refreshes, 2, 'TTL must override drift lockout');
    assert.equal(third.refreshed, true);
    assert.equal(third.stats.totalPostCount, 235);
});

test('the TTL refreshes a matching cache to update shares and average', async () => {
    let refreshes = 0;
    let now = 0;
    const reconciler = createStatsReconciler({
        readCached: async () => ({ ...CACHED, totalApproved: 94 }),
        refresh: async () => { refreshes += 1; return FRESH; },
        logger: silentLogger(),
        now: () => now,
    });

    await reconciler.getSnapshot({ liveTotal: 94 });
    assert.equal(refreshes, 0);

    now = STATS_REFRESH_TTL_MS + 1;
    const snapshot = await reconciler.getSnapshot({ liveTotal: 94 });

    assert.equal(refreshes, 1);
    assert.equal(snapshot.refreshed, true);
    assert.equal(snapshot.stats.totalPostCount, 235);
});

test('a failed refresh falls back to the cache and the live count', async () => {
    const logger = silentLogger();
    let refreshes = 0;
    const reconciler = createStatsReconciler({
        readCached: async () => CACHED,
        refresh: async () => { refreshes += 1; throw new Error('statement timeout'); },
        logger,
        now: () => 0,
    });

    const snapshot = await reconciler.getSnapshot({ liveTotal: 94 });

    assert.equal(refreshes, 1);
    assert.equal(snapshot.refreshed, false);
    assert.equal(snapshot.stats.totalApproved, 94); // live count, never stale
    assert.equal(snapshot.stats.totalPostCount, 219); // cached shares
    assert.equal(snapshot.stats.updatedAt, CACHED.updatedAt, 'updatedAt must remain the original cache timestamp, not bumped on failure');
    assert.ok(logger.messages.some((line) => line.includes('Community stats refresh failed')));
});

test('a failed refresh is not retried until the cooldown elapses', async () => {
    let refreshes = 0;
    let now = 0;
    const reconciler = createStatsReconciler({
        readCached: async () => CACHED,
        refresh: async () => { refreshes += 1; throw new Error('boom'); },
        logger: silentLogger(),
        cooldownMs: 1000,
        now: () => now,
    });

    await reconciler.getSnapshot({ liveTotal: 94 });
    assert.equal(refreshes, 1);

    now = 500;
    await reconciler.getSnapshot({ liveTotal: 94 });
    assert.equal(refreshes, 1, 'still cooling down');

    now = 1000;
    await reconciler.getSnapshot({ liveTotal: 94 });
    assert.equal(refreshes, 2, 'cooldown elapsed');
});

test('concurrent stale reads share one in-flight refresh', async () => {
    let refreshes = 0;
    let resolveRefresh;
    const pending = new Promise((resolve) => { resolveRefresh = resolve; });

    const reconciler = createStatsReconciler({
        readCached: async () => CACHED,
        refresh: () => { refreshes += 1; return pending; },
        logger: silentLogger(),
        now: () => 0,
    });

    const first = reconciler.getSnapshot({ liveTotal: 94 });
    const second = reconciler.getSnapshot({ liveTotal: 94 });

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(refreshes, 1, 'both requests must share the same refresh');

    resolveRefresh(FRESH);
    const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);

    assert.deepEqual(firstSnapshot.stats, FRESH);
    assert.deepEqual(secondSnapshot.stats, FRESH);
    assert.equal(firstSnapshot.refreshed, true);
    assert.equal(secondSnapshot.refreshed, true);
});

test('a malformed RPC payload is treated as a failed refresh', async () => {
    const logger = silentLogger();
    const reconciler = createStatsReconciler({
        readCached: async () => CACHED,
        refresh: async () => ({ totalApproved: Number.NaN }),
        logger,
        now: () => 0,
    });

    const snapshot = await reconciler.getSnapshot({ liveTotal: 94 });

    assert.equal(snapshot.refreshed, false);
    assert.equal(snapshot.stats.totalApproved, 94);
    assert.equal(snapshot.stats.totalPostCount, 219);
    assert.ok(logger.messages.some((line) => line.includes('invalid statistics')));
});

test('a missing cache row is rebuilt through the RPC', async () => {
    const reconciler = createStatsReconciler({
        readCached: async () => null,
        refresh: async () => FRESH,
        logger: silentLogger(),
        now: () => 0,
    });

    const snapshot = await reconciler.getSnapshot({ liveTotal: 94 });

    assert.equal(snapshot.source, 'fallback');
    assert.equal(snapshot.refreshed, true);
    assert.deepEqual(snapshot.stats, FRESH);
});

test('a missing cache row with a failing RPC rejects instead of publishing zeros', async () => {
    let refreshes = 0;
    const reconciler = createStatsReconciler({
        readCached: async () => null,
        refresh: async () => { refreshes += 1; throw new Error('db unavailable'); },
        logger: silentLogger(),
        cooldownMs: 1000,
        now: () => 0,
    });

    await assert.rejects(
        () => reconciler.getSnapshot({ liveTotal: 94 }),
        /db unavailable/,
    );
    assert.equal(refreshes, 1);

    await assert.rejects(
        () => reconciler.getSnapshot({ liveTotal: 94 }),
        /cooling down/,
    );
    assert.equal(refreshes, 1, 'cooldown must prevent a retry storm');
});
