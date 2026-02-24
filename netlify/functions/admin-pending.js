/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-pending
 * Returns all pending submissions for admin review
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    validateAdmin,
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
    if (!validateAdmin(event)) {
        return error(401, 'غير مصرح بالوصول', origin);
    }

    try {
        const { data, error: queryError } = await supabaseAdmin
            .from('submissions')
            .select('id, message, corrected_message, content_type, author_name, created_at')
            .eq('status', STATUS.PENDING)
            .order('created_at', { ascending: true });

        if (queryError) {
            return error(500, 'حدث خطأ في جلب البيانات', origin, queryError.message);
        }

        return success({
            data: data || [],
            count: data?.length || 0,
        }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
