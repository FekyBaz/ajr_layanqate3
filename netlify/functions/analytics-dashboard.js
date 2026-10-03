/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/analytics-dashboard
 * Admin analytics dashboard data for أجر لا ينقطع
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Requires admin authentication.
 * Returns aggregated analytics data for the dashboard.
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    validateAdminWithRateLimit,
    logger,
} from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    // Admin authentication
    const authResult = await validateAdminWithRateLimit(event);
    // 429 first: brute-force floods are rate-limited even with wrong keys (#76)
    if (authResult.rateLimited) {
        return error(429, 'Rate limited', origin);
    }
    if (!authResult.valid) {
        return error(401, 'Unauthorized', origin);
    }

    try {
        const params = new URLSearchParams(event.queryStringParameters || '');
        const period = params.get('period') || '7d'; // 7d, 30d, 90d
        const startDate = getStartDate(period);

        // Single aggregate RPC (migration 027) — exact full-window numbers
        // with one round trip instead of 10 unbounded reads (#81, #112).
        const { data, error: rpcError } = await supabaseAdmin
            .rpc('get_analytics_dashboard', { p_start: startDate });

        if (rpcError) {
            logger.error('[analytics-dashboard] RPC error:', rpcError.message);
            return error(500, 'Internal server error', origin);
        }

        return success({
            period,
            overview: data.overview,
            traffic_sources: data.traffic_sources,
            top_pages: data.top_pages,
            devices: data.devices,
            geography: data.geography,
            feature_usage: data.feature_usage,
            funnels: data.funnels,
            retention: data.retention,
        }, origin);

    } catch (err) {
        logger.error('[analytics-dashboard] Error:', err.message);
        return error(500, 'Internal server error', origin);
    }
}

function getStartDate(period) {
    const now = new Date();
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    now.setDate(now.getDate() - days);
    return now.toISOString();
}
