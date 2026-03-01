/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-stats
 * Returns submission statistics
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    validateAdminWithRateLimit,
    STATUS,
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
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
    }
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }

    try {
        // Use the aggregation RPC defined in 014 migration
        // Replaces 3 separate expensive count:'exact' queries
        const { data: stats, error: rpcError } = await supabaseAdmin.rpc('get_submission_stats');

        if (rpcError) {
            logger.error('admin-stats RPC error:', rpcError.message, rpcError.code);
            return error(500, 'فشل الاتصال بقاعدة البيانات', origin, rpcError.message);
        }

        return success({
            stats: {
                pending: stats.pending || 0,
                approved: stats.approved || 0,
                rejected: stats.rejected || 0,
            },
        }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
