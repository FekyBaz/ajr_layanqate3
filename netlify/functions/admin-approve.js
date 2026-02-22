/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-approve
 * Approves a submission with optional correction
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabase,
    success,
    error,
    handleOptions,
    validateAdmin,
    sanitizeMessage,
} from './utils/shared.js';
import { incrementGoalProgress } from './utils/community-goal.js';

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
    if (!validateAdmin(event)) {
        return error(401, 'غير مصرح بالوصول', origin);
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
            status: 'Approved',
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
        const { error: updateError } = await supabase
            .from('submissions')
            .update(updateData)
            .eq('id', id)
            .eq('status', 'Pending');

        if (updateError) {
            console.error('Admin approve error:', updateError.message);
            return error(500, 'حدث خطأ في تحديث البيانات', origin);
        }

        try {
            await incrementGoalProgress(1);
        } catch (goalError) {
            console.error('Admin approve goal progress error:', goalError.message);
        }

        return success({ message: 'تمت الموافقة على المشاركة' }, origin);

    } catch (err) {
        console.error('Admin approve error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
