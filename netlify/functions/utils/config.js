/**
 * Validated backend configuration singleton (see issue #102).
 *
 * Single source for every environment variable the functions read.
 * Import `{ config }` from here instead of touching `process.env` directly:
 *
 *   import { config } from './utils/config.js';
 *   const max = config.rateLimitMax;
 *
 * Rules:
 * - Missing hard-required vars (Supabase URL/key) throw ONE aggregated error
 *   at boot so misconfiguration fails fast and loudly.
 * - `requiredInProd` vars (anon key, admin key presence is soft, IP salt)
 *   throw only when NODE_ENV=production, otherwise warn once.
 * - Numerics fall back to documented defaults with a warning on garbage
 *   (a typo must never silently become a 10x looser limit).
 * - The exported object is frozen.
 */

const PRODUCTION_DEFAULTS = {
    rateLimitWindowHours: 24,
    rateLimitMax: 10,
    memoryRateLimitMax: 3,
    memoryRateLimitHours: 24,
    memoryUpdateRateLimitMax: 5,
    memoryUpdateRateLimitHours: 24,
    memoryInteractionDebounceSeconds: 30,
    adminRateLimitMax: 300,
    logLevel: 'info',
};

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

function isProductionEnv() {
    return process.env.NODE_ENV === 'production';
}

function readString(name) {
    const value = process.env[name];
    return typeof value === 'string' ? value : '';
}

function readInt(name, fallback, warnings) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        warnings.push(`${name}=${JSON.stringify(raw)} is not a non-negative integer; using default ${fallback}`);
        return fallback;
    }
    return parsed;
}

function readLogLevel(warnings) {
    const raw = (process.env.LOG_LEVEL || '').trim().toLowerCase();
    if (!raw) return PRODUCTION_DEFAULTS.logLevel;
    if (!VALID_LOG_LEVELS.includes(raw)) {
        warnings.push(`LOG_LEVEL=${JSON.stringify(process.env.LOG_LEVEL)} is unknown; using "info"`);
        return PRODUCTION_DEFAULTS.logLevel;
    }
    return raw;
}

function readSupabaseUrl(errors) {
    const url = readString('SUPABASE_URL').trim();
    if (!url) {
        errors.push('SUPABASE_URL is missing');
        return '';
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            errors.push(`SUPABASE_URL=${JSON.stringify(url)} must be an http(s) URL`);
        }
    } catch {
        errors.push(`SUPABASE_URL=${JSON.stringify(url)} is not a valid URL`);
    }
    return url;
}

function readTimezone(warnings) {
    const raw = readString('TIMEZONE').trim() || 'Asia/Gaza';
    try {
        new Intl.DateTimeFormat('en-CA', { timeZone: raw });
        return raw;
    } catch {
        warnings.push(`TIMEZONE=${JSON.stringify(raw)} is not a valid IANA name; using "Asia/Gaza"`);
        return 'Asia/Gaza';
    }
}

function buildConfig() {
    const errors = [];
    const warnings = [];
    const production = isProductionEnv();

    const supabaseUrl = readSupabaseUrl(errors);
    const supabaseServiceRoleKey = readString('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceRoleKey) errors.push('SUPABASE_SERVICE_ROLE_KEY is missing');

    const supabaseAnonKey = readString('SUPABASE_ANON_KEY');
    if (!supabaseAnonKey) {
        const message = 'SUPABASE_ANON_KEY is missing — public reads will fail closed';
        if (production) errors.push(message);
        else warnings.push(message);
    }

    const adminApiKey = readString('ADMIN_API_KEY') || readString('ADMIN_KEY');
    if (!adminApiKey) {
        warnings.push('Neither ADMIN_API_KEY nor ADMIN_KEY is set — admin endpoints will reject every request');
    }

    const ipSalt = readString('IP_SALT');
    if (!ipSalt) {
        const message = 'IP_SALT is missing — IP hashes are unsalted. Set IP_SALT in production (openssl rand -hex 32)';
        if (production) errors.push(message);
        else warnings.push(message);
    }

    const config = {
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: production,
        logLevel: readLogLevel(warnings),

        supabaseUrl,
        supabaseServiceRoleKey,
        supabaseAnonKey,
        adminApiKey,
        hasAdminKey: adminApiKey !== '',
        ipSalt,

        frontendUrl: readString('FRONTEND_URL').trim(),
        allowedOrigins: readString('ALLOWED_ORIGINS'),
        netlifySiteName: readString('NETLIFY_SITE_NAME').trim(),
        siteTimezone: readTimezone(warnings),

        rateLimitWindowHours: readInt('RATE_LIMIT_WINDOW', PRODUCTION_DEFAULTS.rateLimitWindowHours, warnings),
        rateLimitMax: readInt('RATE_LIMIT_MAX', PRODUCTION_DEFAULTS.rateLimitMax, warnings),
        memoryRateLimitMax: readInt('MEMORY_RATE_LIMIT_MAX', PRODUCTION_DEFAULTS.memoryRateLimitMax, warnings),
        memoryRateLimitHours: readInt('MEMORY_RATE_LIMIT_HOURS', PRODUCTION_DEFAULTS.memoryRateLimitHours, warnings),
        memoryUpdateRateLimitMax: readInt('MEMORY_UPDATE_RATE_LIMIT_MAX', PRODUCTION_DEFAULTS.memoryUpdateRateLimitMax, warnings),
        memoryUpdateRateLimitHours: readInt('MEMORY_UPDATE_RATE_LIMIT_HOURS', PRODUCTION_DEFAULTS.memoryUpdateRateLimitHours, warnings),
        memoryInteractionDebounceSeconds: readInt('MEMORY_INTERACTION_DEBOUNCE', PRODUCTION_DEFAULTS.memoryInteractionDebounceSeconds, warnings),
        adminRateLimitMax: readInt('ADMIN_RATE_LIMIT_MAX', PRODUCTION_DEFAULTS.adminRateLimitMax, warnings),

        gaMeasurementId: readString('GA_MEASUREMENT_ID').trim(),
        ga4PropertyId: readString('GA4_PROPERTY_ID').trim(),
        googleServiceAccountJson: readString('GOOGLE_SERVICE_ACCOUNT_JSON'),
        googleClientId: readString('GOOGLE_CLIENT_ID'),
        googleClientSecret: readString('GOOGLE_CLIENT_SECRET'),
        googleRefreshToken: readString('GOOGLE_REFRESH_TOKEN'),
        telegramBotToken: readString('TELEGRAM_BOT_TOKEN'),
        telegramChatId: readString('TELEGRAM_CHAT_ID'),
    };

    for (const warning of warnings) {
        console.warn(`[config] ${warning}`);
    }

    if (errors.length > 0) {
        throw new Error(`[config] Invalid backend configuration:\n - ${errors.join('\n - ')}\nSee api/.env.example.`);
    }

    return Object.freeze(config);
}

export const config = buildConfig();
