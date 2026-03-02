/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-feedback-update
 * Updates a feedback message status (admin only)
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

    if (event.httpMethod !== 'POST') {
        return error(405, 'Method not allowed', origin);
    }

    // Validate admin authentication
    const authResult = await validateAdminWithRateLimit(event);
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin);
    }
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { id, status, admin_note } = body;

        if (!id || !status) {
            return error(400, 'المعرّف والحالة مطلوبان', origin);
        }

        const { data, error: rpcError } = await supabaseAdmin.rpc('update_feedback_status', {
            p_id: id,
            p_status: status,
            p_admin_note: admin_note || null,
        });

        if (rpcError) {
            logger.error('admin-feedback-update RPC error:', rpcError.message);
            return error(500, 'خطأ في تحديث الحالة', origin);
        }

        if (data && !data.success) {
            if (data.error === 'invalid_status') {
                return error(400, 'حالة غير صالحة', origin);
            }
            if (data.error === 'not_found') {
                return error(404, 'الرسالة غير موجودة', origin);
            }
        }

        return success({ message: 'تم تحديث الحالة بنجاح' }, origin);

    } catch (err) {
        logger.error('admin-feedback-update unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
