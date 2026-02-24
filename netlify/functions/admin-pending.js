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
        const params = event.queryStringParameters || {};
        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 100);
        const page = Math.max(parseInt(params.page, 10) || 1, 1);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Get total count + page data in parallel
        const [countResult, dataResult] = await Promise.all([
            supabaseAdmin
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('status', STATUS.PENDING),
            supabaseAdmin
                .from('submissions')
                .select('id, message, corrected_message, content_type, author_name, created_at')
                .eq('status', STATUS.PENDING)
                .order('created_at', { ascending: true })
                .range(from, to),
        ]);

        if (dataResult.error) {
            return error(500, 'حدث خطأ في جلب البيانات', origin, dataResult.error.message);
        }

        const totalCount = countResult.count || 0;

        return success({
            data: dataResult.data || [],
            count: totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
        }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
