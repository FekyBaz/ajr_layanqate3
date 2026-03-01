/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-memory-reject
 * Reject a pending memorial page (admin only)
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

    // Only allow POST
    if (event.httpMethod !== 'POST') {
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
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const { id } = body;

        if (!id || typeof id !== 'string') {
            return error(400, 'معرف الصفحة مطلوب', origin);
        }

        const { data: updatedRow, error: updateError } = await supabaseAdmin
            .from('memories')
            .update({ status: STATUS.REJECTED })
            .eq('id', id)
            .eq('status', STATUS.PENDING)
            .select('id')
            .maybeSingle();

        if (updateError) {
            return error(500, 'حدث خطأ في تحديث البيانات', origin, updateError.message);
        }

        if (!updatedRow) {
            return error(404, 'الصفحة غير موجودة أو تمت مراجعتها مسبقًا', origin);
        }

        logger.info(`[admin] Memory rejected: ${updatedRow.id}`);

        return success({ message: 'تم رفض صفحة الذكرى' }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
