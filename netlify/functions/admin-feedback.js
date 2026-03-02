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
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
    }
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }

    try {
        const { data, error: rpcError } = await supabaseAdmin.rpc('get_feedback_messages', {
            p_limit: 50,
            p_offset: 0,
        });

        if (rpcError) {
            logger.error('admin-feedback RPC error:', rpcError.message);
            return error(500, 'خطأ في قاعدة البيانات', origin, 'SERVER_ERROR');
        }

        return success(data, origin);

    } catch (err) {
        logger.error('admin-feedback unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, 'SERVER_ERROR');
    }
}
