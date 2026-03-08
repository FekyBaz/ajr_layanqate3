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
        const rawPage = Number.parseInt(event.queryStringParameters?.page || '1', 10);
        const rawPageSize = Number.parseInt(event.queryStringParameters?.pageSize || `${DEFAULT_PAGE_SIZE}`, 10);

        const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
        const pageSize = Number.isNaN(rawPageSize) || rawPageSize < 1
            ? DEFAULT_PAGE_SIZE
            : Math.min(rawPageSize, MAX_PAGE_SIZE);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // RLS enforces status = 'Approved' rows for public client
        const { data, count, error: queryError } = await supabasePublic
            .from('memories')
            .select('id, deceased_name, slug, approved_at', { count: 'exact' })
            .order('approved_at', { ascending: false })
            .range(from, to);

        if (queryError) {
            logger.error('memories-all query error:', queryError.message);
            return error(500, 'حدث خطأ في تحميل البيانات', origin);
        }

        return success({
            data: data || [],
            pagination: {
                page,
                pageSize,
                total: count || 0,
                totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
            },
        }, origin, {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        });

    } catch (err) {
        logger.error('memories-all unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
