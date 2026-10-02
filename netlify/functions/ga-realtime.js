import {
    getRealtime, isGAConfigured, getPropertyId,
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

        const propertyId = getPropertyId();
        const realtime = await getRealtime(propertyId);

        return success({
            configured: true,
            realtime: realtime || { activeUsers: 0 },
        }, origin);

    } catch (err) {
        logger.error('[ga-realtime] Error:', err.message, err.details || '');
        const msg = err.details || err.message || 'Internal server error';
        return error(500, msg, origin);
    }
}
