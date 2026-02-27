/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Shared Utilities for Netlify Functions
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// Shared Constants (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════════════════

export const VISIBLE_STATUSES = ['Approved', 'Posted'];

export const VALID_CONTENT_TYPES = ['dhikr', 'dua', 'ayah', 'hadith', 'benefit'];

export const STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    POSTED: 'Posted',
};

// ═══════════════════════════════════════════════════════════════════════════
// Logger (respects LOG_LEVEL env var: debug | info | warn | error)
// ═══════════════════════════════════════════════════════════════════════════

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;

export const logger = {
    debug: (...args) => { if (CURRENT_LOG_LEVEL <= LOG_LEVELS.debug) console.debug(...args); },
    info: (...args) => { if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) console.log(...args); },
    warn: (...args) => { if (CURRENT_LOG_LEVEL <= LOG_LEVELS.warn) console.warn(...args); },
    error: (...args) => { console.error(...args); },
};

// ═══════════════════════════════════════════════════════════════════════════
// Supabase Clients
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const CLIENT_OPTIONS = {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
};

/**
 * Admin client — uses service_role key, bypasses RLS.
 * Use ONLY for admin operations and writes that require elevated access.
 */
export const supabaseAdmin = createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLIENT_OPTIONS,
);

/**
 * Public client — uses anon key, respects RLS policies.
 * Use for public-facing reads where RLS should be the security boundary.
 * Falls back to service_role key if SUPABASE_ANON_KEY is not set.
 */
export const supabasePublic = createClient(
    SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLIENT_OPTIONS,
);

// Deprecated export removed. Use supabaseAdmin or supabasePublic instead.
// export const supabase = supabaseAdmin;


// ═══════════════════════════════════════════════════════════════════════════
// CORS Headers
// ═══════════════════════════════════════════════════════════════════════════

const PRODUCTION_ORIGIN = process.env.FRONTEND_URL || '';
const ALLOWED_ORIGINS = [
    PRODUCTION_ORIGIN,
    'http://localhost:8888',
    'http://localhost:3000',
].filter(Boolean);

/**
 * Strict regex for Netlify deploy-preview origins.
 * Only matches deploy previews for YOUR specific site, not any .netlify.app domain.
 * Requires NETLIFY_SITE_NAME env var to be set (e.g., "ajr-la-yanqati").
 */
const DEPLOY_PREVIEW_REGEX = process.env.NETLIFY_SITE_NAME
    ? new RegExp(`^https://deploy-preview-\\d+--${process.env.NETLIFY_SITE_NAME}\\.netlify\\.app$`)
    : null;

const SECURITY_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function getCorsHeaders(origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
        (DEPLOY_PREVIEW_REGEX && DEPLOY_PREVIEW_REGEX.test(origin));

    const allowOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

    return {
        ...SECURITY_HEADERS,
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ref-Source',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        Vary: 'Origin',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Response Helpers
// ═══════════════════════════════════════════════════════════════════════════

export function success(data, origin, additionalHeaders = {}) {
    return {
        statusCode: 200,
        headers: {
            ...getCorsHeaders(origin),
            ...additionalHeaders,
        },
        body: JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            ...data
        }),
    };
}

export function error(statusCode, message, origin, devMessage = null) {
    if (devMessage) {
        logger.error(`[HTTP ${statusCode}] ${message} | Dev: ${devMessage}`);
    }

    return {
        statusCode,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
            success: false,
            message,
            ...(process.env.NODE_ENV === 'development' && { debug: devMessage })
        }),
    };
}

export function handleOptions(origin) {
    return {
        statusCode: 204,
        headers: getCorsHeaders(origin),
        body: '',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin Authentication
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_RATE_LIMIT_WINDOW_HOURS = 1;
const ADMIN_RATE_LIMIT_MAX = 60;

export function validateAdmin(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    // Also check X-Admin-Key header for backwards compatibility
    const adminKeyHeader = event.headers['x-admin-key'] || '';

    const adminApiKey = process.env.ADMIN_API_KEY;

    return token === adminApiKey || adminKeyHeader === adminApiKey;
}

/**
 * Rate-limited admin validation.
 * @returns {{ valid: boolean, rateLimited: boolean }}
 */
export async function validateAdminWithRateLimit(event) {
    if (!validateAdmin(event)) {
        return { valid: false, rateLimited: false };
    }

    const clientIP = getClientIP(event);
    const ipHash = crypto.createHash('sha256').update(clientIP || 'unknown').digest('hex').substring(0, 32);

    try {
        const windowStart = new Date();
        windowStart.setHours(windowStart.getHours() - ADMIN_RATE_LIMIT_WINDOW_HOURS);

        const { count, error: countError } = await supabaseAdmin
            .from('rate_limits')
            .select('*', { count: 'exact', head: true })
            .eq('ip_hash', ipHash)
            .gte('created_at', windowStart.toISOString());

        if (countError) {
            logger.error('Admin rate limit check error:', countError.message);
            return { valid: true, rateLimited: false };
        }

        if ((count || 0) >= ADMIN_RATE_LIMIT_MAX) {
            return { valid: true, rateLimited: true };
        }
    } catch (err) {
        logger.error('Admin rate limit error:', err.message);
    }

    return { valid: true, rateLimited: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// Input Sanitization
// ═══════════════════════════════════════════════════════════════════════════

const ARABIC_PATTERN = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669\s\d.,،؛:؟!()«»/\-#_…\\\n\r🌿"']+$/;

export function sanitizeMessage(input) {
    if (typeof input !== 'string') {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    let sanitized = input.trim();

    if (!sanitized) {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    // Defense-in-depth: strip HTML/script even though Arabic regex is the primary gate
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');

    // Collapse whitespace
    sanitized = sanitized.replace(/[ \t]+/g, ' ');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    sanitized = sanitized.trim();

    if (sanitized.length < 3) {
        return { isValid: false, sanitized: '', error: 'المحتوى قصير جدًا' };
    }

    if (sanitized.length > 1000) {
        return { isValid: false, sanitized: '', error: 'المحتوى طويل جدًا' };
    }

    // Primary security gate: Arabic-only content
    if (!ARABIC_PATTERN.test(sanitized)) {
        return { isValid: false, sanitized: '', error: 'يرجى كتابة المحتوى باللغة العربية فقط' };
    }

    return { isValid: true, sanitized };
}

export function sanitizeName(input) {
    if (typeof input !== 'string' || !input.trim()) {
        return null;
    }

    let sanitized = input.trim();
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/\s+/g, ' ');

    if (sanitized.length > 100) {
        sanitized = sanitized.substring(0, 100);
    }

    return sanitized || null;
}

export function validateContentType(contentType) {
    return contentType && VALID_CONTENT_TYPES.includes(contentType);
}

// ═══════════════════════════════════════════════════════════════════════════
// Date & Time Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns YYYY-MM-DD in UTC (Single Source of Truth)
 */
export function getTodayDateKey() {
    return new Date().toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// Hash Generation
// ═══════════════════════════════════════════════════════════════════════════

export function generateMessageHash(message) {
    return crypto.createHash('sha256').update(message, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting (using Supabase table)
// ═══════════════════════════════════════════════════════════════════════════

const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '24', 10); // hours
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '10', 10);

export async function checkRateLimit(ip) {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW);

    // Hash the IP for privacy
    const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 32);

    try {
        const { count, error: countError } = await supabaseAdmin
            .from('rate_limits')
            .select('*', { count: 'exact', head: true })
            .eq('ip_hash', ipHash)
            .gte('created_at', windowStart.toISOString());

        if (countError) {
            // NOTE: Fails open — allows request if rate limit check fails.
            // This avoids blocking legitimate users during DB issues,
            // but means rate limiting is ineffective during outages.
            logger.error('Rate limit check error:', countError.message);
            return true;
        }

        return (count || 0) < RATE_LIMIT_MAX;
    } catch (err) {
        logger.error('Rate limit error:', err.message);
        return true;
    }
}

export async function recordRequest(ip) {
    const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 32);

    try {
        await supabaseAdmin
            .from('rate_limits')
            .insert({ ip_hash: ipHash });
    } catch (err) {
        logger.error('Record request error:', err.message);
    }
}

/**
 * Delete rate_limit records older than 2x the rate limit window.
 * Call from a scheduled function to prevent unbounded table growth.
 */
export async function cleanupRateLimits() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - RATE_LIMIT_WINDOW * 2);

    try {
        const { error: deleteError, count } = await supabaseAdmin
            .from('rate_limits')
            .delete()
            .lt('created_at', cutoff.toISOString());

        if (deleteError) {
            logger.error('Rate limit cleanup error:', deleteError.message);
            return { success: false, error: deleteError.message };
        }

        logger.info('[cleanup] Deleted expired rate limit records', { count });
        return { success: true, count };
    } catch (err) {
        logger.error('Rate limit cleanup error:', err.message);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Get Client IP
// ═══════════════════════════════════════════════════════════════════════════

export function getClientIP(event) {
    return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        event.headers['x-real-ip'] ||
        event.headers['client-ip'] ||
        'unknown';
}
