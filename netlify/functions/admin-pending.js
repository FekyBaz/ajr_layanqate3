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
    validateAdminWithRateLimit,
    STATUS,
    parsePagination,
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
    const authResult = await validateAdminWithRateLimit(event);
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
    }
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }

    try {
        const { page, limit, from, to } = parsePagination(event.queryStringParameters, {
            defaultLimit: 50,
            maxLimit: 100,
        });

        // Get total count + page data in parallel (exact count for real totals)
        const [countResult, dataResult] = await Promise.all([
            supabaseAdmin
                .from('submissions')
                .select('id', { head: true, count: 'exact' })
                .eq('status', STATUS.PENDING),
            supabaseAdmin
                .from('submissions')
                .select('id, message, corrected_message, content_type, author_name, created_at')
                .eq('status', STATUS.PENDING)
                .order('created_at', { ascending: true })
                .range(from, to),
        ]);

        if (countResult.error) {
            return error(500, 'حدث خطأ في جلب البيانات', origin, countResult.error.message);
        }

        if (dataResult.error) {
            return error(500, 'حدث خطأ في جلب البيانات', origin, dataResult.error.message);
        }

        const totalCount = countResult.count || 0;

        return success({
            data: dataResult.data || [],
            count: totalCount,
            page,
            limit,
            totalPages: totalCount === 0 ? 1 : Math.ceil(totalCount / limit),
        }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
