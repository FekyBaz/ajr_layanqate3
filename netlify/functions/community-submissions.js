import { supabase, error, success, handleOptions } from './utils/shared.js';

const VALID_TYPES = ['all', 'dhikr', 'dua', 'ayah', 'hadith'];
const VALID_SORT = ['latest', 'most_shared'];
const VALID_REF_SOURCES = ['instagram', 'facebook', 'direct', 'telegram'];
const PAGE_SIZE = 10;
const RESPONSE_CACHE_CONTROL = 'public, max-age=45, s-maxage=45, stale-while-revalidate=60';

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
}

function sanitizeRefSource(value) {
    if (typeof value !== 'string') return 'direct';
    const normalized = value.trim().toLowerCase();
    return VALID_REF_SOURCES.includes(normalized) ? normalized : 'direct';
}

async function getStatsSnapshot() {
    const { data, error: statsError } = await supabase
        .from('community_stats')
        .select('total_approved,total_post_count,average_post_count,updated_at')
        .eq('id', 1)
        .maybeSingle();

    if (statsError) {
        throw statsError;
    }

    if (data) {
        return {
            stats: {
                totalApproved: Number(data.total_approved) || 0,
                totalPostCount: Number(data.total_post_count) || 0,
                averagePostCount: Number(data.average_post_count) || 0,
                updatedAt: data.updated_at,
            },
            source: 'table',
        };
    }

    const { data: aggregateRows, error: aggregateError, count } = await supabase
        .from('submissions')
        .select('post_count', { count: 'exact' })
        .eq('status', 'Approved');

    if (aggregateError) {
        throw aggregateError;
    }

    const totalPostCount = (aggregateRows || []).reduce((sum, row) => sum + (Number(row.post_count) || 0), 0);
    const totalApproved = count || 0;
    const averagePostCount = totalApproved ? totalPostCount / totalApproved : 0;

    const { error: writeStatsError } = await supabase
        .from('community_stats')
        .upsert({
            id: 1,
            total_approved: totalApproved,
            total_post_count: totalPostCount,
            average_post_count: averagePostCount,
            updated_at: new Date().toISOString(),
        });

    if (writeStatsError) {
        console.error('Community stats fallback write error:', writeStatsError.message);
    }

    return {
        stats: {
            totalApproved,
            totalPostCount,
            averagePostCount,
            updatedAt: new Date().toISOString(),
        },
        source: 'fallback',
    };
}

async function getNewApprovedTodayCount() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count, error: todayError } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Approved')
        .gte('created_at', startOfDay.toISOString());

    if (todayError) {
        throw todayError;
    }

    return count || 0;
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
        const page = parsePositiveInt(params.get('page'), 1);
        const contentType = (params.get('type') || 'all').toLowerCase();
        const sortBy = (params.get('sort') || 'latest').toLowerCase();
        const limit = Math.min(parsePositiveInt(params.get('limit'), PAGE_SIZE), PAGE_SIZE);
        const refSource = sanitizeRefSource(event.headers['x-ref-source'] || event.headers['X-Ref-Source'] || 'direct');

        if (!VALID_TYPES.includes(contentType)) {
            return error(400, 'Invalid content type filter', origin);
        }

        if (!VALID_SORT.includes(sortBy)) {
            return error(400, 'Invalid sorting option', origin);
        }

        console.log('[community-submissions] ref source:', refSource);

        const from = (page - 1) * limit;
        const to = from + limit - 1;

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

        const [statsResult, newApprovedTodayResult] = await Promise.allSettled([
            getStatsSnapshot(),
            getNewApprovedTodayCount(),
        ]);

        if (statsResult.status === 'rejected') {
            console.error('Community stats snapshot failed:', statsResult.reason?.message || 'unknown');
        }

        if (newApprovedTodayResult.status === 'rejected') {
            console.error('Community today count failed:', newApprovedTodayResult.reason?.message || 'unknown');
        }

        const statsPayload = statsResult.status === 'fulfilled'
            ? statsResult.value
            : {
                stats: {
                    totalApproved: count || 0,
                    totalPostCount: (data || []).reduce((sum, row) => sum + (Number(row.post_count) || 0), 0),
                    averagePostCount: 0,
                    updatedAt: new Date().toISOString(),
                },
                source: 'degraded_fallback',
            };

        const newApprovedToday = newApprovedTodayResult.status === 'fulfilled' ? newApprovedTodayResult.value : 0;

        return success({
            submissions: data || [],
            featured: featured || null,
            stats: {
                ...statsPayload.stats,
                newApprovedToday,
                source: statsPayload.source,
            },
            pagination: {
                page,
                pageSize: limit,
                total: count || 0,
                totalPages: Math.max(Math.ceil((count || 0) / limit), 1),
            },
        }, origin, {
            'Cache-Control': RESPONSE_CACHE_CONTROL,
        });
    } catch (err) {
        console.error('Community submissions handler error:', err.message);
        return error(500, 'حدث خطأ غير متوقع', origin);
    }
}
