/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-memory-updates-pending
 * List all pending collaborative proposed updates (admin only)
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
    // 429 first: brute-force floods are rate-limited even with wrong keys (#76)
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
    }

    try {
        // Query memory_updates joined with parent memories to get deceased name & slug
        const { data, error: queryError } = await supabaseAdmin
            .from('memory_updates')
            .select('id, memory_id, proposed_by_name, proposed_by_relation, biography, good_traits, ongoing_charity, external_links, story, created_at, created_by_ip_hash, memories(slug, deceased_name, biography, good_traits, ongoing_charity, external_links, story)')
            .eq('status', STATUS.PENDING)
            .order('created_at', { ascending: true })
            .limit(50);

        if (queryError) {
            logger.error('admin-memory-updates-pending query error:', queryError.message);
            return error(500, 'حدث خطأ في تحميل البيانات من قاعدة البيانات', origin, queryError.message);
        }

        // Restructure response to flatten relation if needed, though standard JS client nesting is fine
        return success({ data: data || [] }, origin);

    } catch (err) {
        logger.error('admin-memory-updates-pending unexpected error:', err.message);
        return error(500, 'حدث خطأ غير متوقع. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
