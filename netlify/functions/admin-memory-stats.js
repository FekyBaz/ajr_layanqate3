/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-memory-stats
 * Returns aggregated statistics for memorial pages
 * ═══════════════════════════════════════════════════════════════════════════
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

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    // Validate admin authentication
    const authResult = await validateAdminWithRateLimit(event);
    // 429 first: brute-force floods are rate-limited even with wrong keys (#76)
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
    }

    try {
        // Call the aggregation RPC defined in 014 migration
        const { data: stats, error: rpcError } = await supabaseAdmin.rpc('get_memory_stats');

        if (rpcError) {
            logger.error('admin-memory-stats RPC error:', rpcError.message);
            return error(500, 'حدث خطأ في جلب الإحصائيات', origin);
        }

        return success({
            stats,
        }, origin);

    } catch (err) {
        logger.error('admin-memory-stats unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
