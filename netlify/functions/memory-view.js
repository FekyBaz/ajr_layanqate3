/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/memory-view?slug=...
 * Fetch a single approved memorial page by slug
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabasePublic,
    success,
    error,
    handleOptions,
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

    try {
        const slug = event.queryStringParameters?.slug;

        if (!slug || typeof slug !== 'string' || slug.length > 100) {
            return error(400, 'رابط الصفحة غير صالح', origin);
        }

        // Use public client — RLS enforces status = 'Approved'
        const { data: memory, error: queryError } = await supabasePublic
            .from('memories')
            .select('id, slug, deceased_name, relation, message, total_interactions, tasbeeh_count, dua_count, share_count, created_at, approved_at, last_activity_at')
            .eq('slug', slug)
            .maybeSingle();

        if (queryError) {
            logger.error('memory-view query error:', queryError.message);
            return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
        }

        if (!memory) {
            return error(404, 'الصفحة غير موجودة أو قيد المراجعة', origin);
        }

        // Compute activity status (active = interaction within last 7 days)
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        memory.is_active = !!(memory.last_activity_at &&
            (Date.now() - new Date(memory.last_activity_at).getTime()) < SEVEN_DAYS_MS);

        return success({
            memory,
        }, origin, {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        });

    } catch (err) {
        logger.error('memory-view unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
