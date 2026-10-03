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

// Public visibility set — single source of truth for every supabasePublic
// query. MUST stay identical to the anon SELECT policies or public reads
// silently return empty: submissions → migration 007
// ("Public visible read only", status IN ('Approved','Posted')); memories
// stay Approved-only (migration 013, "Memories public approved read") and
// therefore always filter STATUS.APPROVED explicitly, never this list.
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
 * Use for public-facing reads where RLS must remain the security boundary.
 *
 * Fail-closed by design (#80): SUPABASE_ANON_KEY MUST be set. When it is
 * missing the client is initialized with a placeholder key that Supabase
 * rejects with 401 on every request, so reads fail with 500 envelopes
 * instead of silently bypassing RLS. The service_role key is NEVER used
 * here — a single missing env var must not disable the entire RLS layer.
 */
const PUBLIC_KEY = process.env.SUPABASE_ANON_KEY;
if (!PUBLIC_KEY) {
    logger.error('[shared] SUPABASE_ANON_KEY is not set. Public reads will fail closed (no silent RLS bypass).');
}
export const supabasePublic = createClient(
    SUPABASE_URL,
    PUBLIC_KEY || 'SUPABASE_ANON_KEY_NOT_CONFIGURED',
    CLIENT_OPTIONS,
);

// Deprecated export removed. Use supabaseAdmin or supabasePublic instead.
// export const supabase = supabaseAdmin;


// ═══════════════════════════════════════════════════════════════════════════
// CORS Headers
// ═══════════════════════════════════════════════════════════════════════════

function normalizeOrigin(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function parseOriginsCsv(value) {
    return String(value || '')
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean);
}

const PRODUCTION_ORIGIN = normalizeOrigin(process.env.FRONTEND_URL);
const ALLOWED_ORIGINS = Array.from(new Set([
    ...parseOriginsCsv(process.env.ALLOWED_ORIGINS),
    PRODUCTION_ORIGIN,
    'http://localhost:8888',
    'http://localhost:3000',
].filter(Boolean)));

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
    const normalizedOrigin = normalizeOrigin(origin);
    const isAllowed = ALLOWED_ORIGINS.includes(normalizedOrigin) ||
        (DEPLOY_PREVIEW_REGEX && DEPLOY_PREVIEW_REGEX.test(normalizedOrigin));

    // Deny by default: disallowed origins get 'null' (never echoed back and
    // never the first allow-listed origin, which would poison caches).
    // allowOrigin mirrors the request origin only when it is allow-listed.
    const allowOrigin = isAllowed && normalizedOrigin ? normalizedOrigin : 'null';

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
    const errorCode = statusCode === 400 ? 'VALIDATION_ERROR'
        : statusCode === 401 ? 'INVALID_CREDENTIALS'
            : statusCode === 403 ? 'FORBIDDEN'
                : statusCode === 404 ? 'NOT_FOUND'
                    : statusCode === 405 ? 'METHOD_NOT_ALLOWED'
                        : statusCode === 429 ? 'RATE_LIMIT_EXCEEDED'
                            : statusCode === 500 ? 'SERVER_ERROR'
                                : statusCode === 502 ? 'BAD_GATEWAY'
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
const ADMIN_RATE_LIMIT_MAX = parseInt(process.env.ADMIN_RATE_LIMIT_MAX) || 300;

/**
 * Constant-time string comparison (via SHA-256 digests, so unequal
 * lengths do not leak through short-circuit `===` timing).
 */
function timingSafeCompare(a, b) {
    const digestA = crypto.createHash('sha256').update(String(a)).digest();
    const digestB = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(digestA, digestB);
}

export function validateAdmin(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    // X-Admin-Key is used by the shipped admin panel (admin.js); both
    // vectors are accepted and both are compared in constant time.
    const adminKeyHeader = event.headers['x-admin-key'] || '';

    // Support both ADMIN_API_KEY and ADMIN_KEY env var names
    const adminApiKey = process.env.ADMIN_API_KEY || process.env.ADMIN_KEY;

    if (!adminApiKey) {
        logger.error('[AUTH] Neither ADMIN_API_KEY nor ADMIN_KEY env var is set!');
        return false;
    }

    const isValid = (token && timingSafeCompare(token, adminApiKey)) ||
        (adminKeyHeader && timingSafeCompare(adminKeyHeader, adminApiKey));

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
 *
 * The attempt is logged and the window count is enforced BEFORE the key
 * itself is checked, so brute-force floods hit 429 even with wrong keys.
 * Callers must check `rateLimited` before `valid` (429 takes precedence).
 * @returns {{ valid: boolean, rateLimited: boolean }}
 */
export async function validateAdminWithRateLimit(event) {
    const clientIP = getClientIP(event);
    const ipHash = crypto.createHash('sha256').update(clientIP || 'unknown').digest('hex').substring(0, 32);

    // [SECURITY] We log EVERY attempt, including failures, to prevent brute-forcing.
    // Tagged as 'admin' source to avoid polluting user submission rate limits.
    try {
        await recordRequest(clientIP, 'admin');
    } catch (logLimitError) {
        logger.error('Admin attempt logging failed:', logLimitError.message);
    }

    // Enforce the flood threshold before validating the key.
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
        } else if ((count || 0) >= ADMIN_RATE_LIMIT_MAX) {
            return { valid: false, rateLimited: true };
        }
    } catch (err) {
        logger.error('Admin rate limit error:', err.message);
    }

    const isValid = validateAdmin(event);
    if (!isValid) {
        return { valid: false, rateLimited: false };
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
    return crypto.createHash('sha256').update(normalizeMessageForHash(message), 'utf8').digest('hex');
}

/**
 * Normalize text before duplicate hashing (#78) so trivial variants
 * (case, extra spaces, Arabic diacritics/tatweel) map to one bucket.
 * NFKD + harakat/tatweel strip + lowercase + whitespace collapse.
 */
export function normalizeMessageForHash(message) {
    return String(message || '')
        .normalize('NFKD')
        // Arabic harakat (U+064B–U+065F), superscript alef (U+0670), tatweel (U+0640)
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Escape LIKE wildcards in user search input (#78) so `%`/`_`/`\`
 * are matched literally instead of acting as wildcards.
 */
export function escapeIlikePattern(value) {
    return String(value || '').replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting (using Supabase table)
// ═══════════════════════════════════════════════════════════════════════════

const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '24', 10); // hours
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '10', 10);

// Generous per-endpoint write limits for hot endpoints that previously had
// no rate limiting at all (#77). Generous on purpose: these are low-cost
// writes where false positives hurt more than abuse.
export const HOT_ENDPOINT_RATE_LIMITS = {
    fatiha: { windowHours: 24, max: 100 },
    analytics: { windowHours: 24, max: 200 },
    share: { windowHours: 24, max: 200 },
    view: { windowHours: 24, max: 500 },
};

let ipSaltWarned = false;

/**
 * Single IP-hash function for the whole backend (#77).
 * Salted with IP_SALT and truncated to 32 hex chars. All writers
 * (submit/memory RPC hashes, checkRateLimit/recordRequest, view
 * deduplication) must use this so the same IP lands in one bucket.
 * Warns once when IP_SALT is missing (required in production).
 */
export function hashIP(ip) {
    const salt = process.env.IP_SALT || '';
    if (!salt && !ipSaltWarned) {
        ipSaltWarned = true;
        logger.warn('[shared] IP_SALT is not set — IP hashes are unsalted. Set IP_SALT in production.');
    }
    return crypto.createHash('sha256').update((ip || 'unknown') + salt).digest('hex').substring(0, 32);
}

export async function checkRateLimit(ip, source = 'submit', options = {}) {
    const windowHours = options.windowHours || RATE_LIMIT_WINDOW;
    const max = options.max || RATE_LIMIT_MAX;
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - windowHours);

    // Hash the IP for privacy (single salted function, see hashIP)
    const ipHash = hashIP(ip);

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

        return (count || 0) < max;
    } catch (err) {
        logger.error('Rate limit error:', err.message);
        return true;
    }
}

export async function recordRequest(ip, source = 'submit') {
    const ipHash = hashIP(ip);

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

// (removed: legacy unsalted full-length hashIP — use the single salted
// hashIP() in the Rate Limiting section so all buckets agree, see #77)


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
