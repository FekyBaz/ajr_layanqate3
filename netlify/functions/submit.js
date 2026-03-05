/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/submit
 * Submit a new dhikr/dua/ayah/hadith
 * ═══════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';
import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    sanitizeMessage,
    sanitizeName,
    validateContentType,
    generateMessageHash,
    checkRateLimit,
    recordRequest,
    getClientIP,
    logger,
} from './utils/shared.js';

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
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const { message, content_type, author_name } = body;

        // Validate content type
        if (!validateContentType(content_type)) {
            return error(400, 'نوع المحتوى غير صالح', origin);
        }

        // Sanitize message
        const messageResult = sanitizeMessage(message);
        if (!messageResult.isValid) {
            return error(400, messageResult.error, origin);
        }

        // Sanitize name (optional)
        const sanitizedName = sanitizeName(author_name);

        // Generate message hash for duplicate detection
        const messageHash = generateMessageHash(messageResult.sanitized);

        // Get client IP and check rate limit
        const clientIP = getClientIP(event);
        const ipHash = crypto
            .createHash('sha256')
            .update((clientIP || 'unknown') + (process.env.IP_SALT || ''))
            .digest('hex')
            .substring(0, 32);

        // Call atomic check-and-insert RPC to prevent rate limit bypass race conditions
        const { data: result, error: rpcError } = await supabaseAdmin.rpc('submit_post', {
            p_message: messageResult.sanitized,
            p_message_hash: messageHash,
            p_content_type: content_type,
            p_author_name: sanitizedName,
            p_ip_hash: ipHash,
            p_rate_limit_max: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
            p_rate_limit_hours: parseInt(process.env.RATE_LIMIT_WINDOW || '24', 10),
        });

        if (rpcError) {
            logger.error('Submit RPC error:', rpcError.message);
            return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
        }

        if (!result.success) {
            if (result.reason === 'rate_limit_exceeded') {
                return error(429, 'تم تجاوز الحد المسموح من المشاركات. يرجى المحاولة لاحقًا.', origin);
            }
            // duplicate goes here, we return success
        }

        return success({ message: 'تم استلام مشاركتك. جزاك الله خيرًا.' }, origin);

    } catch (err) {
        logger.error('Unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
