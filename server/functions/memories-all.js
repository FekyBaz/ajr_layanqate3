/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/memories-all
 * Returns approved memorial pages (paginated)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabasePublic,
    success,
    error,
    handleOptions,
    logger,
    STATUS,
    parsePagination,
    escapeIlikePattern,
} from './utils/shared.js';

const MAX_PAGE_SIZE = 60;
const DEFAULT_PAGE_SIZE = 24;

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        const { page, limit, from, to } = parsePagination(event.queryStringParameters, {
            defaultLimit: DEFAULT_PAGE_SIZE,
            maxLimit: MAX_PAGE_SIZE,
        });
        // Cap search length and escape LIKE wildcards so % _ \ match literally (#78)
        const searchQuery = (event.queryStringParameters?.search?.trim() || '').slice(0, 50);

        // RLS enforces status = 'Approved' rows for public client
        // Explicitly filter by approved status as defense-in-depth security measure
        let query = supabasePublic
            .from('memories')
            .select('id, deceased_name, slug, approved_at', { count: 'exact' })
            .eq('status', STATUS.APPROVED)
            .order('approved_at', { ascending: false });

        if (searchQuery) {
            query = query.ilike('deceased_name', `%${escapeIlikePattern(searchQuery)}%`);
        }

        const { data, count, error: queryError } = await query.range(from, to);

        if (queryError) {
            logger.error('memories-all query error:', queryError.message);
            return error(500, 'حدث خطأ في تحميل البيانات', origin);
        }

        return success({
            data: data || [],
            pagination: {
                page,
                pageSize: limit,
                total: count || 0,
                totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
            },
        }, origin, {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        });

    } catch (err) {
        logger.error('memories-all unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
