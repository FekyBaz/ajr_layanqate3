/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Shared Utilities for Netlify Functions
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// Environment Validation (fail-fast on startup)
// ═══════════════════════════════════════════════════════════════════════════

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const MISSING_ENV = REQUIRED_ENV.filter(key => !process.env[key]);

if (MISSING_ENV.length > 0) {
    throw new Error(
        `[shared] Missing required environment variables: ${MISSING_ENV.join(', ')}. ` +
        'These must be set in Netlify dashboard or .env for local development.'
    );
}

// Warn on missing optional-but-recommended vars
const RECOMMENDED_ENV = ['SUPABASE_ANON_KEY', 'ADMIN_API_KEY', 'IP_SALT'];
const MISSING_RECOMMENDED = RECOMMENDED_ENV.filter(key => !process.env[key]);
if (MISSING_RECOMMENDED.length > 0) {
    console.warn(`[shared] Missing recommended environment variables: ${MISSING_RECOMMENDED.join(', ')}`);
}

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
 * SUPABASE_ANON_KEY MUST be set. If missing, the client is initialized
 * with an invalid key so that any use will fail with an auth error
 * rather than silently bypassing RLS with service_role credentials.
 */
const PUBLIC_KEY = process.env.SUPABASE_ANON_KEY;
if (!PUBLIC_KEY) {
    logger.warn('[shared] SUPABASE_ANON_KEY is not set. Falling back to service role key with explicit filters.');
}
export const supabasePublic = createClient(
    SUPABASE_URL,
    PUBLIC_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'SUPABASE_ANON_KEY_NOT_CONFIGURED',
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

    // Safe fallback: never return empty string as Access-Control-Allow-Origin
    const allowOrigin = isAllowed && origin
        ? origin
        : (ALLOWED_ORIGINS.find(Boolean) || 'null');

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
    const errorCode = statusCode === 401 ? 'INVALID_CREDENTIALS'
        : statusCode === 429 ? 'RATE_LIMIT_EXCEEDED'
            : statusCode === 400 ? 'VALIDATION_ERROR'
                : statusCode === 405 ? 'METHOD_NOT_ALLOWED'
                    : statusCode === 500 ? 'SERVER_ERROR'
                        : 'UNKNOWN_ERROR';

    const body = { success: false, message, error_code: errorCode };

    if (devMessage && (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug')) {
        body.dev_message = devMessage;
    }

    return {
        statusCode,
        headers: getCorsHeaders(origin),
        body: JSON.stringify(body),
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

    // Support both ADMIN_API_KEY and ADMIN_KEY env var names
    const adminApiKey = process.env.ADMIN_API_KEY || process.env.ADMIN_KEY;

    if (!adminApiKey) {
        logger.error('[AUTH] Neither ADMIN_API_KEY nor ADMIN_KEY env var is set!');
        return false;
    }

    const isValid = (token && token === adminApiKey) || (adminKeyHeader && adminKeyHeader === adminApiKey);

    if (!isValid) {
        logger.debug('[AUTH] Validation failed.',
            'Header received:', adminKeyHeader ? 'yes' : 'no',
            'Bearer received:', token ? 'yes' : 'no',
            'Key configured:', adminApiKey ? 'yes' : 'no'
        );
    }

    return isValid;
}

/**
 * Rate-limited admin validation.
 * @returns {{ valid: boolean, rateLimited: boolean }}
 */
export async function validateAdminWithRateLimit(event) {
    const isValid = validateAdmin(event);
    const clientIP = getClientIP(event);
    const ipHash = crypto.createHash('sha256').update(clientIP || 'unknown').digest('hex').substring(0, 32);

    // [SECURITY] We log EVERY attempt, including failures, to prevent brute-forcing.
    // This happens BEFORE we return 'valid: false' to ensure failed attempts are counted.
    // Tagged as 'admin' source to avoid polluting user submission rate limits.
    try {
        await recordRequest(clientIP, 'admin');
    } catch (logLimitError) {
        logger.error('Admin attempt logging failed:', logLimitError.message);
    }

    if (!isValid) {
        return { valid: false, rateLimited: false };
    }

    try {
        const windowStart = new Date();
        windowStart.setHours(windowStart.getHours() - ADMIN_RATE_LIMIT_WINDOW_HOURS);

        // Uses the composite index (ip_hash, source, created_at)
        const { count, error: countError } = await supabaseAdmin
            .from('rate_limits')
            .select('id', { head: true, count: 'exact' })
            .eq('ip_hash', ipHash)
            .eq('source', 'admin')
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

export function sanitizeMessage(input) {
    if (typeof input !== 'string') {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    let sanitized = input.trim();

    if (!sanitized) {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    // Defense-in-depth: strip HTML/script; security relies on sanitization + parameterized operations
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

export async function checkRateLimit(ip, source = 'submit') {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW);

    // Hash the IP for privacy
    const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 32);

    try {
        const { count, error: countError } = await supabaseAdmin
            .from('rate_limits')
            .select('id', { head: true, count: 'exact' })
            .eq('ip_hash', ipHash)
            .eq('source', source)
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

export async function recordRequest(ip, source = 'submit') {
    const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 32);

    try {
        await supabaseAdmin
            .from('rate_limits')
            .insert({ ip_hash: ipHash, source });
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

export function hashIP(ip) {
    return crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
}


// ═══════════════════════════════════════════════════════════════════════════
// Phase 3: Legacy Hub Helpers
// ═══════════════════════════════════════════════════════════════════════════

export function sanitizeLegacyText(input, minLen, maxLen, isRequired) {
    if (typeof input !== 'string') {
        return { isValid: !isRequired, sanitized: null, error: isRequired ? 'هذا الحقل مطلوب' : null };
    }

    let sanitized = input.trim();
    if (!sanitized) {
        return { isValid: !isRequired, sanitized: null, error: isRequired ? 'هذا الحقل مطلوب' : null };
    }

    // Defense-in-depth: strip dangerous patterns (security does NOT rely on language filtering)
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');  // inline event handlers
    sanitized = sanitized.replace(/[ \t]+/g, ' ');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

    if (sanitized.length < minLen) {
        return { isValid: false, sanitized: null, error: `المحتوى قصير جدًا (الأدنى ${minLen} أحرف)` };
    }

    if (sanitized.length > maxLen) {
        return { isValid: false, sanitized: null, error: `المحتوى طويل جدًا (الأقصى ${maxLen} حرف)` };
    }

    return { isValid: true, sanitized };
}

export function sanitizeExternalLinks(linksArray) {
    if (!Array.isArray(linksArray) || linksArray.length === 0) {
        return { isValid: true, links: null };
    }

    if (linksArray.length > 5) {
        return { isValid: false, links: null, error: 'الحد الأقصى للروابط هو 5' };
    }

    const validLinks = [];
    for (let i = 0; i < linksArray.length; i++) {
        const link = linksArray[i];
        if (!link || typeof link !== 'object') continue;

        let title = link.title ? link.title.trim().replace(/<[^>]*>/g, '') : '';
        let url = link.url ? link.url.trim() : '';

        if (!url) continue;

        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return { isValid: false, links: null, error: `الرابط ${i + 1}: يجب أن يبدأ بـ http:// أو https://` };
            }
            if (!parsed.hostname || parsed.hostname.length < 3) {
                return { isValid: false, links: null, error: `الرابط ${i + 1}: عنوان الموقع غير صالح` };
            }
            validLinks.push({ title: title.substring(0, 100), url: parsed.href });
        } catch (e) {
            return { isValid: false, links: null, error: `الرابط ${i + 1}: رابط غير صالح` };
        }
    }

    return { isValid: true, links: validLinks.length > 0 ? validLinks : null };
}
