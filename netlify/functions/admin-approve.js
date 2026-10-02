/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-approve
 * Approves a submission with optional correction
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    validateAdminWithRateLimit,
    sanitizeMessage,
    STATUS,
    logger,
} from './utils/shared.js';
import { incrementGoalProgress } from './utils/community-goal.js';
import { sendTelegramNotification } from './utils/telegram.js';

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
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const { id, corrected_message } = body;

        // Validate ID
        if (!id || typeof id !== 'string') {
            return error(400, 'معرف المشاركة مطلوب', origin);
        }

        // Prepare update data
        const updateData = {
            status: STATUS.APPROVED,
            reviewed_at: new Date().toISOString(),
        };

        // If correction provided, sanitize and add it
        if (corrected_message && typeof corrected_message === 'string') {
            const correctionResult = sanitizeMessage(corrected_message);

            if (!correctionResult.isValid) {
                return error(400, `خطأ في التصحيح: ${correctionResult.error}`, origin);
            }

            updateData.corrected_message = correctionResult.sanitized;
        }

        // Update in database
        logger.info(`[Admin Approve] Attempting to approve submission ID: ${id}`);
        const { data: updatedRow, error: updateError } = await supabaseAdmin
            .from('submissions')
            .update(updateData)
            .eq('id', id)
            .eq('status', STATUS.PENDING)
            .select('id, message, corrected_message, content_type, author_name')
            .maybeSingle();

        if (updateError) {
            logger.error('[Admin Approve] Supabase update error:', updateError.message);
            return error(500, 'حدث خطأ في تحديث البيانات', origin, updateError.message);
        }

        if (!updatedRow) {
            logger.warn(`[Admin Approve] Submission ${id} not found or not pending.`);
            return error(404, 'المشاركة غير موجودة أو تمت مراجعتها مسبقًا', origin);
        }

        logger.info(`[Admin Approve] Successfully approved in database. Row:`, updatedRow);

        // Increment Goal Progress
        try {
            logger.info('[Admin Approve] Incrementing goal progress...');
            await incrementGoalProgress(1);
            logger.info('[Admin Approve] Goal progress incremented successfully.');
        } catch (goalError) {
            logger.error('[Admin Approve] Goal progress increment error:', goalError.message);
        }

        // Send Telegram Notification
        try {
            logger.info('[Admin Approve] Sending telegram notification...');
            await sendTelegramNotification(updatedRow);
            logger.info('[Admin Approve] Telegram notification sending process finished.');
        } catch (tgError) {
            logger.error('[Admin Approve] Telegram notification catch block error:', tgError.message);
        }

        return success({ message: 'تمت الموافقة على المشاركة وبثها' }, origin);

    } catch (err) {
        logger.error('[Admin Approve] Critical handler error:', err.message, err.stack);
        return error(500, 'حدث خطأ داخلي في السيرفر', origin, err.message);
    }
}
