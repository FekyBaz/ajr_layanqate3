/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-feedback
 * Returns feedback messages for admin panel
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    logger,
    parsePagination,
    validateAdminWithRateLimit,
} from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

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
        // Read optional status filter + pagination from query string
        const params = event.queryStringParameters || {};
        const statusFilter = params.status || null;
        const { page, limit, from } = parsePagination(params, {
            defaultLimit: 50,
            maxLimit: 100,
        });

        const { data, error: rpcError } = await supabaseAdmin.rpc('get_feedback_messages', {
            p_status: statusFilter,
            p_limit: limit,
            p_offset: from,
        });

        if (rpcError) {
            logger.error('admin-feedback RPC error:', rpcError.message);
            return error(500, 'خطأ في قاعدة البيانات', origin, 'SERVER_ERROR');
        }

        const total = data?.total || 0;

        return success({
            data: data?.data || [],
            total,
            new_count: data?.new_count || 0,
            page,
            limit,
            totalPages: total === 0 ? 1 : Math.ceil(total / limit),
        }, origin);

    } catch (err) {
        logger.error('admin-feedback unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, 'SERVER_ERROR');
    }
}
