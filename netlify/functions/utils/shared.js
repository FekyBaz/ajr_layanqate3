/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Shared Utilities for Netlify Functions
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// Supabase Client
// ═══════════════════════════════════════════════════════════════════════════

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// ═══════════════════════════════════════════════════════════════════════════
// CORS Headers
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:8888', // netlify dev
    'http://localhost:3000',
];

export function getCorsHeaders(origin) {
    // Check if origin is allowed or is a Netlify preview
    const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
        (origin && origin.includes('.netlify.app')) ||
        (origin && origin.includes('--') && origin.includes('.netlify.app'));

    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Response Helpers
// ═══════════════════════════════════════════════════════════════════════════

export function success(data, origin) {
    return {
        statusCode: 200,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({ success: true, ...data }),
    };
}

export function error(statusCode, message, origin) {
    return {
        statusCode,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({ success: false, message }),
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

export function validateAdmin(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    // Also check X-Admin-Key header for backwards compatibility
    const adminKeyHeader = event.headers['x-admin-key'] || '';

    const adminApiKey = process.env.ADMIN_API_KEY;

    return token === adminApiKey || adminKeyHeader === adminApiKey;
}

// ═══════════════════════════════════════════════════════════════════════════
// Input Sanitization
// ═══════════════════════════════════════════════════════════════════════════

const VALID_CONTENT_TYPES = ['dhikr', 'dua', 'ayah', 'hadith'];

const ARABIC_PATTERN = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669\s\d.,،؛:؟!()«»\-\n\r]+$/;

export function sanitizeMessage(input) {
    if (typeof input !== 'string') {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    let sanitized = input.trim();

    if (!sanitized) {
        return { isValid: false, sanitized: '', error: 'المحتوى مطلوب' };
    }

    // Strip HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove script injections
    sanitized = sanitized.replace(/javascript:/gi, '');
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
        // Count requests in window
        const { count, error } = await supabase
            .from('rate_limits')
            .select('*', { count: 'exact', head: true })
            .eq('ip_hash', ipHash)
            .gte('created_at', windowStart.toISOString());

        if (error) {
            console.error('Rate limit check error:', error.message);
            return true; // Allow on error
        }

        return (count || 0) < RATE_LIMIT_MAX;
    } catch (err) {
        console.error('Rate limit error:', err.message);
        return true; // Allow on error
    }
}

export async function recordRequest(ip) {
    const ipHash = crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 32);

    try {
        await supabase
            .from('rate_limits')
            .insert({ ip_hash: ipHash });
    } catch (err) {
        console.error('Record request error:', err.message);
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
