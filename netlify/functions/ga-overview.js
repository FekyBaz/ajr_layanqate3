import {
    getOverview, getRealtime, isGAConfigured, getPropertyId,
} from './utils/ga-api.js';
import {
    success, error, handleOptions, validateAdminWithRateLimit, logger,
} from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';
    if (event.httpMethod === 'OPTIONS') return handleOptions(origin);
    if (event.httpMethod !== 'GET') return error(405, 'Method not allowed', origin);

    const auth = await validateAdminWithRateLimit(event);
    // 429 first: brute-force floods are rate-limited even with wrong keys (#76)
    if (auth.rateLimited) return error(429, 'Rate limited', origin);
    if (!auth.valid) return error(401, 'Unauthorized', origin);

    try {
        if (!isGAConfigured()) {
            return success({ configured: false, message: 'GA4 not configured — set GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUNT_JSON' }, origin);
        }

        const params = new URLSearchParams(event.queryStringParameters || '');
        const period = params.get('period') || '30d';
        const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
        const propertyId = getPropertyId();

        const [overview, realtime] = await Promise.all([
            getOverview(propertyId, days),
            getRealtime(propertyId),
        ]);

        if (!overview) {
            return error(502, 'Failed to fetch GA4 data — check service account credentials', origin);
        }

        const formatDuration = (seconds) => {
            const m = Math.floor(seconds / 60);
            const s = Math.round(seconds % 60);
            return m > 0 ? `${m}m ${s}s` : `${s}s`;
        };

        return success({
            configured: true,
            period,
            overview: {
                active_users: overview.activeUsers || 0,
                sessions: overview.sessions || 0,
                page_views: overview.screenPageViews || 0,
                avg_session_duration_sec: Math.round(overview.avgSessionDuration || 0),
                avg_session_duration: formatDuration(overview.avgSessionDuration || 0),
                bounce_rate: parseFloat((overview.bounceRate || 0).toFixed(1)),
                new_users: overview.newUsers || 0,
                total_users: overview.totalUsers || 0,
            },
            realtime: {
                active_users: (realtime && realtime.activeUsers) || 0,
            },
        }, origin);

    } catch (err) {
        logger.error('[ga-overview] Error:', err.message, err.details || '');
        return error(500, 'Internal server error', origin, err.message);
    }
}
