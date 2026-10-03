/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-memory-update-reject
 * Reject a proposed memory update (admin only)
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
    // 429 first: brute-force floods are rate-limited even with wrong keys (#76)
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
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
            return error(400, 'معرف الاقتراح مطلوب', origin);
        }

        // Update proposal status to Rejected
        const { data: updatedProposal, error: updateError } = await supabaseAdmin
            .from('memory_updates')
            .update({
                status: STATUS.REJECTED,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('status', STATUS.PENDING)
            .select('id, memory_id')
            .maybeSingle();

        if (updateError) {
            logger.error('admin-memory-update-reject database update error:', updateError.message);
            return error(500, 'حدث خطأ أثناء تحديث حالة الاقتراح في قاعدة البيانات', origin, updateError.message);
        }

        if (!updatedProposal) {
            return error(404, 'الاقتراح غير موجود أو تم البت فيه مسبقًا', origin);
        }

        logger.info(`[admin] Memory update rejected. Proposal ID: ${id}`);

        return success({
            message: 'تم رفض التغييرات المقترحة بنجاح.',
            proposal_id: id,
        }, origin);

    } catch (err) {
        logger.error('admin-memory-update-reject unexpected error:', err.message);
        return error(500, 'حدث خطأ غير متوقع. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
