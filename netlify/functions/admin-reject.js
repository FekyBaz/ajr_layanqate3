/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-reject
 * Rejects a submission
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
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const { id } = body;

        // Validate ID
        if (!id || typeof id !== 'string') {
            return error(400, 'معرف المشاركة مطلوب', origin);
        }

        // Update in database
        const { data: updatedRow, error: updateError } = await supabaseAdmin
            .from('submissions')
            .update({
                status: STATUS.REJECTED,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('status', STATUS.PENDING)
            .select('id')
            .maybeSingle();

        if (updateError) {
            logger.error('Admin reject error:', updateError.message);
            return error(500, 'حدث خطأ في تحديث البيانات', origin);
        }

        if (!updatedRow) {
            return error(404, 'المشاركة غير موجودة أو تمت مراجعتها مسبقًا', origin);
        }

        return success({ message: 'تم رفض المشاركة' }, origin);

    } catch (err) {
        logger.error('Admin reject error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
