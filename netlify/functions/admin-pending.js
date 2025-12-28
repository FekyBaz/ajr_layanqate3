/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-pending
 * Returns all pending submissions for admin review
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

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    // Validate admin authentication
    if (!validateAdmin(event)) {
        return error(401, 'غير مصرح بالوصول', origin);
    }

    try {
        const { data, error: queryError } = await supabase
            .from('submissions')
            .select('id, message, corrected_message, content_type, author_name, created_at')
            .eq('status', 'Pending')
            .order('created_at', { ascending: true });

        if (queryError) {
            console.error('Admin pending query error:', queryError.message);
            return error(500, 'حدث خطأ في جلب البيانات', origin);
        }

        return success({
            data: data || [],
            count: data?.length || 0,
        }, origin);

    } catch (err) {
        console.error('Admin pending error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
