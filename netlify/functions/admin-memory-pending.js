/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-memory-pending
 * List all pending memorial pages (admin only)
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

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    // Validate admin authentication
    const authResult = await validateAdminWithRateLimit(event);
    if (!authResult.valid) {
        return error(401, 'غير مصرح بالوصول', origin);
    }
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }

    try {
        const { data, error: queryError } = await supabaseAdmin
            .from('memories')
            .select('id, slug, deceased_name, relation, message, biography, good_traits, ongoing_charity, external_links, story, created_at, created_by_ip_hash')
            .eq('status', STATUS.PENDING)
            .order('created_at', { ascending: true })
            .limit(50);

        if (queryError) {
            return error(500, 'حدث خطأ في تحميل البيانات', origin, queryError.message);
        }

        return success({ data: data || [] }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
