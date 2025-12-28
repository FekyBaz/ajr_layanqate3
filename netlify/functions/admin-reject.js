/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-reject
 * Rejects a submission
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabase,
    success,
    error,
    handleOptions,
    validateAdmin,
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

        const { id } = body;

        // Validate ID
        if (!id || typeof id !== 'string') {
            return error(400, 'معرف المشاركة مطلوب', origin);
        }

        // Update in database
        const { error: updateError } = await supabase
            .from('submissions')
            .update({
                status: 'Rejected',
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('status', 'Pending');

        if (updateError) {
            console.error('Admin reject error:', updateError.message);
            return error(500, 'حدث خطأ في تحديث البيانات', origin);
        }

        return success({ message: 'تم رفض المشاركة' }, origin);

    } catch (err) {
        console.error('Admin reject error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
