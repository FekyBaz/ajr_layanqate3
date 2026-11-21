import {
    getTopPages, getDeviceBreakdown, getGeography, isGAConfigured, getPropertyId,
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
            return success({ configured: false }, origin);
        }

        const params = new URLSearchParams(event.queryStringParameters || '');
        const period = params.get('period') || '30d';
        const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
        const propertyId = getPropertyId();

        const [pages, devices, geography] = await Promise.all([
            getTopPages(propertyId, days, 20),
            getDeviceBreakdown(propertyId, days),
            getGeography(propertyId, days),
        ]);

        return success({
            configured: true,
            period,
            top_pages: pages || [],
            devices: devices || { devices: [], browsers: [] },
            geography: geography || [],
        }, origin);

    } catch (err) {
        logger.error('[ga-content] Error:', err.message, err.details || '');
        return error(500, 'Internal server error', origin, err.message);
    }
}
