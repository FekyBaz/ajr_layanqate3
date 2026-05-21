/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/analytics
 * Privacy-first product analytics ingestion for أجر لا ينقطع
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Accepts analytics events from the client-side tracker.
 * Does NOT store IPs, personal data, or any PII.
 * Session IDs are anonymized hashes.
 */

import crypto from 'crypto';
import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    logger,
    getClientIP,
} from './utils/shared.js';

// Valid event types — reject anything else
const VALID_EVENT_TYPES = new Set([
    'page_view',
    'click',
    'submit',
    'share',
    'scroll',
    'error',
    'form_start',
    'form_complete',
    'form_abandon',
    'cta_click',
    'outbound_click',
    'memory_view',
    'memory_submit',
    'memory_share',
    'adhkar_open',
    'adhkar_complete',
    'fatiha_read',
    'martyr_view',
    'search',
    'filter',
    'navigation',
    'session_start',
    'session_end',
]);

// Max event data payload size
const MAX_EVENT_DATA_BYTES = 2048;

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch {
            return error(400, 'Invalid request body', origin);
        }

        // Support batch events
        const events = Array.isArray(body) ? body : [body];

        if (events.length === 0 || events.length > 20) {
            return error(400, 'Between 1 and 20 events per request', origin);
        }

        const clientIP = getClientIP(event);
        const userAgent = event.headers['user-agent'] || '';

        // Process each event
        const inserted = [];
        for (const evt of events) {
            const result = await processEvent(evt, clientIP, userAgent, event);
            if (result) inserted.push(result);
        }

        return success({ count: inserted.length }, origin);

    } catch (err) {
        logger.error('[analytics] Unexpected error:', err.message);
        return error(500, 'Internal server error', origin);
    }
}

async function processEvent(evt, clientIP, userAgent, reqEvent) {
    // Validate event type
    if (!evt.type || !VALID_EVENT_TYPES.has(evt.type)) {
        logger.warn('[analytics] Invalid event type:', evt.type);
        return null;
    }

    // Validate session ID (must be present, max 64 chars)
    if (!evt.session_id || typeof evt.session_id !== 'string' || evt.session_id.length > 64) {
        logger.warn('[analytics] Invalid session_id');
        return null;
    }

    // Sanitize page path
    const pagePath = sanitizeString(evt.page_path, 500);
    const pageTitle = sanitizeString(evt.page_title, 200);

    // Sanitize referrer (origin only, no full URL with params)
    const referrer = sanitizeReferrer(evt.referrer);
    const referrerDomain = extractDomain(referrer);

    // Sanitize UTM parameters
    const utm_source = sanitizeString(evt.utm_source, 100);
    const utm_medium = sanitizeString(evt.utm_medium, 100);
    const utm_campaign = sanitizeString(evt.utm_campaign, 200);
    const utm_content = sanitizeString(evt.utm_content, 100);
    const utm_term = sanitizeString(evt.utm_term, 100);

    // Sanitize event data (limit size)
    let eventData = {};
    if (evt.data && typeof evt.data === 'object') {
        const jsonStr = JSON.stringify(evt.data);
        if (jsonStr.length <= MAX_EVENT_DATA_BYTES) {
            eventData = evt.data;
        }
    }

    // Device detection from user agent
    const deviceInfo = detectDevice(userAgent);

    // Screen dimensions (validate)
    const screenWidth = validateInt(evt.screen_width, 0, 10000);
    const screenHeight = validateInt(evt.screen_height, 0, 10000);

    // Language
    const language = sanitizeString(evt.language, 20);

    // Geographic (from headers if available)
    const country = sanitizeString(evt.country || reqEvent.headers['cf-ipcountry'] || reqEvent.headers['x-vercel-ip-country'], 2);
    const region = sanitizeString(evt.region, 100);

    // Performance metrics
    const loadTimeMs = validateInt(evt.load_time_ms, 0, 300000);
    const interactionTimeMs = validateInt(evt.interaction_time_ms, 0, 300000);

    // Build insert record
    const record = {
        event_type: evt.type,
        event_name: sanitizeString(evt.name, 100),
        event_data: eventData,
        page_path: pagePath,
        page_title: pageTitle,
        referrer: referrer,
        referrer_domain: referrerDomain,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        session_id: evt.session_id,
        is_returning: evt.is_returning === true,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        screen_width: screenWidth,
        screen_height: screenHeight,
        language,
        country,
        region,
        load_time_ms: loadTimeMs,
        interaction_time_ms: interactionTimeMs,
    };

    // Insert into Supabase
    const { error: insertError } = await supabaseAdmin
        .from('analytics_events')
        .insert(record);

    if (insertError) {
        logger.error('[analytics] Insert error:', insertError.message);
        return null;
    }

    return { type: evt.type, session_id: evt.session_id };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeString(value, maxLength) {
    if (typeof value !== 'string') return null;
    const sanitized = value.trim().substring(0, maxLength);
    return sanitized || null;
}

function sanitizeReferrer(value) {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        // Return origin only — no path, no query params (privacy)
        return url.origin || null;
    } catch {
        return null;
    }
}

function extractDomain(referrer) {
    if (!referrer) return null;
    try {
        const url = new URL(referrer);
        return url.hostname.replace(/^www\./, '') || null;
    } catch {
        return null;
    }
}

function validateInt(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < min || num > max) return null;
    return Math.round(num);
}

function detectDevice(userAgent) {
    const ua = userAgent.toLowerCase();

    // Device type
    let deviceType = 'desktop';
    if (/mobile|android|iphone|ipod/i.test(ua)) deviceType = 'mobile';
    else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';

    // Browser
    let browser = 'unknown';
    if (/firefox/i.test(ua)) browser = 'firefox';
    else if (/edg/i.test(ua)) browser = 'edge';
    else if (/chrome/i.test(ua)) browser = 'chrome';
    else if (/safari/i.test(ua)) browser = 'safari';
    else if (/opera|opr/i.test(ua)) browser = 'opera';

    // OS
    let os = 'unknown';
    if (/android/i.test(ua)) os = 'android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'ios';
    else if (/windows/i.test(ua)) os = 'windows';
    else if (/mac os|macintosh/i.test(ua)) os = 'macos';
    else if (/linux/i.test(ua)) os = 'linux';

    return { deviceType, browser, os };
}
