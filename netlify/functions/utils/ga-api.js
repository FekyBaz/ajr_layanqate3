import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { OAuth2Client } from 'google-auth-library';

let client = null;
let reportCache = new Map();
const CACHE_TTL = {
    overview: 120000,
    topPages: 180000,
    acquisition: 180000,
    realtime: 30000,
};

function getClient() {
    if (client) return client;
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) return null;

    // Path 1: Service Account (GOOGLE_SERVICE_ACCOUNT_JSON)
    const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccount) {
        let credentials;
        try { credentials = JSON.parse(serviceAccount); } catch {
            console.error('[ga-api] Invalid GOOGLE_SERVICE_ACCOUNT_JSON — not valid JSON');
            return null;
        }
        if (!credentials.client_email || !credentials.private_key) {
            console.error('[ga-api] GOOGLE_SERVICE_ACCOUNT_JSON missing client_email or private_key');
            return null;
        }
        client = new BetaAnalyticsDataClient({ credentials });
        return client;
    }

    // Path 2: OAuth2 with refresh token
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (clientId && clientSecret && refreshToken) {
        const oauth2Client = new OAuth2Client({ clientId, clientSecret });
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
            }
        });
        client = new BetaAnalyticsDataClient({
            authClient: oauth2Client,
            scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        });
        return client;
    }

    console.error('[ga-api] No GA4 credentials configured. Set either GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN');
    return null;
}

export function isGAConfigured() {
    if (!process.env.GA4_PROPERTY_ID) return false;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return true;
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) return true;
    return false;
}

export function getPropertyId() {
    return process.env.GA4_PROPERTY_ID || '';
}

function getCacheKey(name, params) {
    return name + ':' + JSON.stringify(params);
}

async function withCache(name, params, fetcher, ttl) {
    const key = getCacheKey(name, params);
    const cached = reportCache.get(key);
    if (cached && Date.now() < cached.expires) {
        return cached.data;
    }
    try {
        const data = await fetcher();
        reportCache.set(key, { data, expires: Date.now() + ttl });
        return data;
    } catch (err) {
        const stale = reportCache.get(key);
        if (stale) return stale.data;
        throw err;
    }
}

export function clearCache() {
    reportCache.clear();
}

export async function getOverview(propertyId, days) {
    const c = getClient();
    if (!c) return null;

    return withCache('overview', { days }, async () => {
        const dateRange = days === 7
            ? { startDate: '7daysAgo', endDate: 'today' }
            : days === 90
                ? { startDate: '90daysAgo', endDate: 'today' }
                : { startDate: '30daysAgo', endDate: 'today' };

        const [response] = await c.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [dateRange],
            metrics: [
                { name: 'activeUsers' },
                { name: 'sessions' },
                { name: 'averageSessionDuration' },
                { name: 'bounceRate' },
                { name: 'screenPageViews' },
                { name: 'newUsers' },
                { name: 'totalUsers' },
            ],
        });

        const metricMap = {};
        if (response.rows && response.rows.length > 0) {
            response.rows[0].metricValues.forEach((v, i) => {
                const names = ['activeUsers', 'sessions', 'avgSessionDuration', 'bounceRate', 'screenPageViews', 'newUsers', 'totalUsers'];
                metricMap[names[i]] = parseFloat(v.value || '0');
            });
        }

        return metricMap;
    }, CACHE_TTL.overview);
}

export async function getTopPages(propertyId, days, limit) {
    const c = getClient();
    if (!c) return null;

    return withCache('topPages', { days, limit }, async () => {
        const dateRange = days === 7
            ? { startDate: '7daysAgo', endDate: 'today' }
            : days === 90
                ? { startDate: '90daysAgo', endDate: 'today' }
                : { startDate: '30daysAgo', endDate: 'today' };

        const [response] = await c.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [dateRange],
            dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
            metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: limit || 20,
        });

        return (response.rows || []).map(row => ({
            path: row.dimensionValues[0].value,
            title: row.dimensionValues[1].value,
            views: parseInt(row.metricValues[0].value || '0'),
            users: parseInt(row.metricValues[1].value || '0'),
        }));
    }, CACHE_TTL.topPages);
}

export async function getAcquisition(propertyId, days) {
    const c = getClient();
    if (!c) return null;

    return withCache('acquisition', { days }, async () => {
        const dateRange = days === 7
            ? { startDate: '7daysAgo', endDate: 'today' }
            : days === 90
                ? { startDate: '90daysAgo', endDate: 'today' }
                : { startDate: '30daysAgo', endDate: 'today' };

        const [sessionResponse] = await c.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [dateRange],
            dimensions: [{ name: 'sessionDefaultChannelGroup' }],
            metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 10,
        });

        const [sourceResponse] = await c.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [dateRange],
            dimensions: [{ name: 'firstUserSource' }],
            metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 10,
        });

        const channels = (sessionResponse.rows || []).map(row => ({
            channel: row.dimensionValues[0].value,
            sessions: parseInt(row.metricValues[0].value || '0'),
            users: parseInt(row.metricValues[1].value || '0'),
            newUsers: parseInt(row.metricValues[2].value || '0'),
        }));

        const sources = (sourceResponse.rows || []).map(row => ({
            source: row.dimensionValues[0].value,
            sessions: parseInt(row.metricValues[0].value || '0'),
            users: parseInt(row.metricValues[1].value || '0'),
        }));

        return { channels, sources };
    }, CACHE_TTL.acquisition);
}

export async function getRealtime(propertyId) {
    const c = getClient();
    if (!c) return null;

    return withCache('realtime', {}, async () => {
        try {
            const [response] = await c.runRealtimeReport({
                property: `properties/${propertyId}`,
                metrics: [{ name: 'activeUsers' }],
                minuteRanges: [{ name: 'last 30 minutes', startMinutesAgo: 30 }],
            });

            const activeUsers = response.rows && response.rows.length > 0
                ? parseInt(response.rows[0].metricValues[0].value || '0')
                : 0;

            return { activeUsers };
        } catch {
            return { activeUsers: 0 };
        }
    }, CACHE_TTL.realtime);
}

export async function getDeviceBreakdown(propertyId, days) {
    const c = getClient();
    if (!c) return null;

    return withCache('devices', { days }, async () => {
        const dateRange = days === 7
            ? { startDate: '7daysAgo', endDate: 'today' }
            : days === 90
                ? { startDate: '90daysAgo', endDate: 'today' }
                : { startDate: '30daysAgo', endDate: 'today' };

        const [deviceResponse] = await c.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [dateRange],
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        });

        const [browserResponse] = await c.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [dateRange],
            dimensions: [{ name: 'browser' }],
            metrics: [{ name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            limit: 8,
        });

        const devices = (deviceResponse.rows || []).map(row => ({
            category: row.dimensionValues[0].value,
            users: parseInt(row.metricValues[0].value || '0'),
            sessions: parseInt(row.metricValues[1].value || '0'),
        }));

        const browsers = (browserResponse.rows || []).map(row => ({
            name: row.dimensionValues[0].value,
            users: parseInt(row.metricValues[0].value || '0'),
        }));

        return { devices, browsers };
    }, CACHE_TTL.acquisition);
}

export async function getGeography(propertyId, days) {
    const c = getClient();
    if (!c) return null;

    return withCache('geography', { days }, async () => {
        const dateRange = days === 7
            ? { startDate: '7daysAgo', endDate: 'today' }
            : days === 90
                ? { startDate: '90daysAgo', endDate: 'today' }
                : { startDate: '30daysAgo', endDate: 'today' };

        const [response] = await c.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [dateRange],
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            limit: 20,
        });

        return (response.rows || []).map(row => ({
            country: row.dimensionValues[0].value,
            users: parseInt(row.metricValues[0].value || '0'),
            sessions: parseInt(row.metricValues[1].value || '0'),
        }));
    }, CACHE_TTL.acquisition);
}
