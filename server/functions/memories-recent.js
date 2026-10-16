/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/memories-recent
 * Returns up to 3 recently approved memorial pages (public, lightweight)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabasePublic,
    success,
    error,
    handleOptions,
    logger,
    STATUS,
} from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        // RLS enforces status = 'Approved' — no sensitive fields returned
        // Explicitly filter by approved status as defense-in-depth security measure
        const { data, error: queryError } = await supabasePublic
            .from('memories')
            .select('id, deceased_name, slug, approved_at')
            .eq('status', STATUS.APPROVED)
            .order('approved_at', { ascending: false })
            .limit(3);

        if (queryError) {
            logger.error('memories-recent query error:', queryError.message);
            return error(500, 'حدث خطأ في تحميل البيانات', origin);
        }

        return success({ data: data || [] }, origin, {
            'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
        });

    } catch (err) {
        logger.error('memories-recent unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
