/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/contact
 * Submits a private feedback/contact message
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    logger,
    hashIP,
    getClientIP,
    sanitizeMessage,
} from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'POST') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { name, email, message } = body;

        // Validate message (required, 10-1000 chars)
        if (!message || typeof message !== 'string') {
            return error(400, 'الرسالة مطلوبة', origin, 'VALIDATION_ERROR');
        }

        // Sanitize message
        const msgResult = sanitizeMessage(message);
        if (!msgResult.isValid) {
            return error(400, msgResult.error, origin, 'VALIDATION_ERROR');
        }

        if (msgResult.sanitized.length < 10) {
            return error(400, 'الرسالة قصيرة جدًا (الأدنى 10 أحرف)', origin, 'VALIDATION_ERROR');
        }

        // Sanitize name (optional)
        let cleanName = null;
        if (name && typeof name === 'string') {
            cleanName = name.trim().replace(/<[^>]*>/g, '').substring(0, 100) || null;
        }

        // Sanitize email (optional, basic format check)
        let cleanEmail = null;
        if (email && typeof email === 'string') {
            const trimmed = email.trim().substring(0, 200);
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                cleanEmail = trimmed;
            }
        }

        // Hash IP
        const clientIP = getClientIP(event);
        const ipHash = hashIP(clientIP);

        // Call RPC (handles rate limiting internally)
        const { data, error: rpcError } = await supabaseAdmin.rpc('submit_feedback', {
            p_name: cleanName,
            p_email: cleanEmail,
            p_message: msgResult.sanitized,
            p_ip_hash: ipHash,
        });

        if (rpcError) {
            logger.error('contact RPC error:', rpcError.message);
            return error(500, 'حدث خطأ في إرسال الرسالة', origin, 'SERVER_ERROR');
        }

        if (data && !data.success) {
            if (data.error === 'rate_limited') {
                return error(429, 'تم تجاوز الحد المسموح. يرجى المحاولة لاحقًا.', origin, 'RATE_LIMIT_EXCEEDED');
            }
            return error(400, 'حدث خطأ في البيانات المرسلة', origin, 'VALIDATION_ERROR');
        }

        return success({ message: 'تم إرسال رسالتك بنجاح. جزاك الله خيرًا.' }, origin);

    } catch (err) {
        logger.error('contact unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, 'SERVER_ERROR');
    }
}
