/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/analytics-dashboard
 * Admin analytics dashboard data for أجر لا ينقطع
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Requires admin authentication.
 * Returns aggregated analytics data for the dashboard.
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    validateAdminWithRateLimit,
    logger,
} from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    // Admin authentication
    const authResult = await validateAdminWithRateLimit(event);
    if (!authResult.valid) {
        return error(401, 'Unauthorized', origin);
    }
    if (authResult.rateLimited) {
        return error(429, 'Rate limited', origin);
    }

    try {
        const params = new URLSearchParams(event.queryStringParameters || '');
        const period = params.get('period') || '7d'; // 7d, 30d, 90d
        const startDate = getStartDate(period);

        const data = await Promise.all([
            getOverviewStats(startDate),
            getTrafficSources(startDate),
            getTopPages(startDate),
            getDeviceBreakdown(startDate),
            getGeographicData(startDate),
            getFeatureUsage(startDate),
            getFunnelData(startDate),
            getRetentionData(startDate),
        ]);

        return success({
            period,
            overview: data[0],
            traffic_sources: data[1],
            top_pages: data[2],
            devices: data[3],
            geography: data[4],
            feature_usage: data[5],
            funnels: data[6],
            retention: data[7],
        }, origin);

    } catch (err) {
        logger.error('[analytics-dashboard] Error:', err.message);
        return error(500, 'Internal server error', origin);
    }
}

function getStartDate(period) {
    const now = new Date();
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    now.setDate(now.getDate() - days);
    return now.toISOString();
}

async function getOverviewStats(startDate) {
    const { data: events } = await supabaseAdmin
        .from('analytics_events')
        .select('event_type, session_id, is_returning, created_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

    if (!events || events.length === 0) {
        return {
            page_views: 0,
            unique_visitors: 0,
            returning_visitors: 0,
            total_events: 0,
            avg_events_per_session: 0,
            daily_trend: [],
        };
    }

    const sessions = new Set(events.map(e => e.session_id));
    const returning = events.filter(e => e.is_returning).length;
    const pageViews = events.filter(e => e.event_type === 'page_view').length;

    // Daily trend
    const dailyMap = {};
    events.forEach(e => {
        const day = e.created_at.slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { views: 0, sessions: new Set() };
        dailyMap[day].views++;
        dailyMap[day].sessions.add(e.session_id);
    });

    const dailyTrend = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
            date,
            views: data.views,
            visitors: data.sessions.size,
        }));

    return {
        page_views: pageViews,
        unique_visitors: sessions.size,
        returning_visitors: returning,
        total_events: events.length,
        avg_events_per_session: Math.round(events.length / sessions.size * 10) / 10,
        daily_trend: dailyTrend,
    };
}

async function getTrafficSources(startDate) {
    const { data } = await supabaseAdmin
        .from('analytics_events')
        .select('referrer_domain, utm_source, utm_medium')
        .eq('event_type', 'page_view')
        .gte('created_at', startDate);

    if (!data || data.length === 0) return [];

    const sourceMap = {};
    data.forEach(e => {
        const source = e.utm_source || e.referrer_domain || 'direct';
        if (!sourceMap[source]) sourceMap[source] = 0;
        sourceMap[source]++;
    });

    return Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
}

async function getTopPages(startDate) {
    const { data } = await supabaseAdmin
        .from('analytics_events')
        .select('page_path, page_title')
        .eq('event_type', 'page_view')
        .gte('created_at', startDate);

    if (!data || data.length === 0) return [];

    const pageMap = {};
    data.forEach(e => {
        if (!pageMap[e.page_path]) pageMap[e.page_path] = { count: 0, title: e.page_title };
        pageMap[e.page_path].count++;
    });

    return Object.entries(pageMap)
        .map(([path, info]) => ({ path, title: info.title, views: info.count }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20);
}

async function getDeviceBreakdown(startDate) {
    const { data } = await supabaseAdmin
        .from('analytics_events')
        .select('device_type, browser, os')
        .eq('event_type', 'page_view')
        .gte('created_at', startDate);

    if (!data || data.length === 0) return { devices: [], browsers: [], os: [] };

    const counts = { device_type: {}, browser: {}, os: {} };
    data.forEach(e => {
        if (e.device_type) counts.device_type[e.device_type] = (counts.device_type[e.device_type] || 0) + 1;
        if (e.browser) counts.browser[e.browser] = (counts.browser[e.browser] || 0) + 1;
        if (e.os) counts.os[e.os] = (counts.os[e.os] || 0) + 1;
    });

    const toArr = (obj) => Object.entries(obj).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    return {
        devices: toArr(counts.device_type),
        browsers: toArr(counts.browser),
        os: toArr(counts.os),
    };
}

async function getGeographicData(startDate) {
    const { data } = await supabaseAdmin
        .from('analytics_events')
        .select('country')
        .eq('event_type', 'page_view')
        .gte('created_at', startDate);

    if (!data || data.length === 0) return [];

    const countryMap = {};
    data.forEach(e => {
        if (e.country) countryMap[e.country] = (countryMap[e.country] || 0) + 1;
    });

    return Object.entries(countryMap)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30);
}

async function getFeatureUsage(startDate) {
    const { data } = await supabaseAdmin
        .from('analytics_events')
        .select('event_type, event_name')
        .gte('created_at', startDate);

    if (!data || data.length === 0) return {};

    const counts = {};
    data.forEach(e => {
        const key = e.event_name || e.event_type;
        counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
}

async function getFunnelData(startDate) {
    // Landing → Interaction funnel
    const { data: pageViews } = await supabaseAdmin
        .from('analytics_events')
        .select('session_id')
        .eq('event_type', 'page_view')
        .eq('page_path', '/index.html')
        .gte('created_at', startDate);

    const landingSessions = new Set(pageViews?.map(e => e.session_id) || []);

    const { data: interactions } = await supabaseAdmin
        .from('analytics_events')
        .select('session_id')
        .in('event_type', ['click', 'scroll', 'cta_click'])
        .gte('created_at', startDate);

    const interactionSessions = new Set(interactions?.map(e => e.session_id) || []);

    const { data: submissions } = await supabaseAdmin
        .from('analytics_events')
        .select('session_id')
        .eq('event_type', 'submit')
        .gte('created_at', startDate);

    const submissionSessions = new Set(submissions?.map(e => e.session_id) || []);

    return {
        landing_to_interaction: {
            total: landingSessions.size,
            converted: [...landingSessions].filter(s => interactionSessions.has(s)).length,
        },
        landing_to_submission: {
            total: landingSessions.size,
            converted: [...landingSessions].filter(s => submissionSessions.has(s)).length,
        },
    };
}

async function getRetentionData(startDate) {
    const { data } = await supabaseAdmin
        .from('analytics_events')
        .select('session_id, is_returning, created_at')
        .eq('event_type', 'page_view')
        .gte('created_at', startDate);

    if (!data || data.length === 0) return { returning_rate: 0, repeat_sessions: 0 };

    const totalSessions = new Set(data.map(e => e.session_id)).size;
    const returningSessions = new Set(data.filter(e => e.is_returning).map(e => e.session_id)).size;

    return {
        returning_rate: totalSessions > 0 ? Math.round(returningSessions / totalSessions * 100) : 0,
        repeat_sessions: returningSessions,
        total_sessions: totalSessions,
    };
}
