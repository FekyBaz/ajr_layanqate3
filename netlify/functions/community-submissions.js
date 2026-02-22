import { supabase, error, success, handleOptions } from './utils/shared.js';

const VALID_TYPES = ['all', 'dhikr', 'dua', 'ayah', 'hadith'];
const VALID_SORT = ['latest', 'most_shared'];
const VALID_REF_SOURCES = ['instagram', 'facebook', 'direct', 'telegram'];
const PAGE_SIZE = 10;

function sanitizeRefSource(value) {
    if (typeof value !== 'string') return 'direct';
    const normalized = value.trim().toLowerCase();
    return VALID_REF_SOURCES.includes(normalized) ? normalized : 'direct';
}

async function getApprovedAggregateStats() {
    const { data, error: aggregateError } = await supabase
        .from('submissions')
        .select('post_count')
        .eq('status', 'Approved');

    if (aggregateError) {
        throw aggregateError;
    }

    const rows = data || [];
    const totalPostCount = rows.reduce((sum, row) => sum + (Number(row.post_count) || 0), 0);
    const averagePostCount = rows.length ? totalPostCount / rows.length : 0;

    return {
        totalPostCount,
        averagePostCount,
    };
}

export async function handler(event) {
    const origin = event.headers.origin || event.headers.Origin;

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        const params = new URLSearchParams(event.queryStringParameters || {});
        const page = Math.max(parseInt(params.get('page') || '1', 10), 1);
        const contentType = (params.get('type') || 'all').toLowerCase();
        const sortBy = (params.get('sort') || 'latest').toLowerCase();
        const refSource = sanitizeRefSource(event.headers['x-ref-source'] || event.headers['X-Ref-Source'] || 'direct');

        if (!VALID_TYPES.includes(contentType)) {
            return error(400, 'Invalid content type filter', origin);
        }

        if (!VALID_SORT.includes(sortBy)) {
            return error(400, 'Invalid sorting option', origin);
        }

        console.log('[community-submissions] ref source:', refSource);

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let baseQuery = supabase
            .from('submissions')
            .select(
                'id,message,corrected_message,author_name,content_type,created_at,post_count',
                { count: 'exact' }
            )
            .eq('status', 'Approved');

        if (contentType !== 'all') {
            baseQuery = baseQuery.eq('content_type', contentType);
        }

        if (sortBy === 'most_shared') {
            baseQuery = baseQuery.order('post_count', { ascending: false }).order('created_at', { ascending: false });
        } else {
            baseQuery = baseQuery.order('created_at', { ascending: false });
        }

        const { data, error: fetchError, count } = await baseQuery.range(from, to);

        if (fetchError) {
            console.error('Community submissions fetch error:', fetchError.message);
            return error(500, 'تعذر تحميل المشاركات المعتمدة', origin);
        }

        const { data: featured, error: featuredError } = await supabase
            .from('submissions')
            .select('id,message,corrected_message,author_name,content_type,created_at,post_count')
            .eq('status', 'Approved')
            .gt('post_count', 0)
            .order('post_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (featuredError) {
            console.error('Featured submission fetch error:', featuredError.message);
        }

        const stats = await getApprovedAggregateStats();

        return success({
            submissions: data || [],
            featured: featured || null,
            stats,
            pagination: {
                page,
                pageSize: PAGE_SIZE,
                total: count || 0,
                totalPages: Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1),
            },
        }, origin);
    } catch (err) {
        console.error('Community submissions handler error:', err.message);
        return error(500, 'حدث خطأ غير متوقع', origin);
    }
}
