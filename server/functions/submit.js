/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/submit
 * Submit a new dhikr/dua/ayah/hadith
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    sanitizeMessage,
    sanitizeName,
    validateContentType,
    generateMessageHash,
    hashIP,
    getClientIP,
    logger,
} from './utils/shared.js';
import { config } from './utils/config.js';

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
            logger.error('[submit] JSON parse error:', e.message);
            return error(400, 'طلب غير صالح', origin);
        }

        const { message, content_type, author_name } = body;
        logger.info('[submit] Received:', { content_type, messageLength: message?.length, hasAuthor: !!author_name });

        // Validate content type
        if (!validateContentType(content_type)) {
            logger.warn('[submit] Invalid content_type:', content_type);
            return error(400, 'نوع المحتوى غير صالح', origin);
        }

        // Sanitize message
        const messageResult = sanitizeMessage(message);
        if (!messageResult.isValid) {
            logger.warn('[submit] Sanitize failed:', messageResult.error);
            return error(400, messageResult.error, origin);
        }

        // Sanitize name (optional)
        const sanitizedName = sanitizeName(author_name);

        // Generate message hash for duplicate detection
        const messageHash = generateMessageHash(messageResult.sanitized);

        // Get client IP and hash it (single salted hashIP; the atomic RPC
        // below enforces the rate limit, so no separate check here)
        const clientIP = getClientIP(event);
        const ipHash = hashIP(clientIP);

        logger.info('[submit] Calling submit_post RPC...', { ipHash, clientIP, rateLimitMax: config.rateLimitMax, rateLimitHours: config.rateLimitWindowHours });

        // Call atomic check-and-insert RPC to prevent rate limit bypass race conditions
        const { data: result, error: rpcError } = await supabaseAdmin.rpc('submit_post', {
            p_message: messageResult.sanitized,
            p_message_hash: messageHash,
            p_content_type: content_type,
            p_author_name: sanitizedName,
            p_ip_hash: ipHash,
            p_rate_limit_max: config.rateLimitMax,
            p_rate_limit_hours: config.rateLimitWindowHours,
        });

        if (rpcError) {
            logger.error('[submit] RPC error:', rpcError.message, '| details:', rpcError.details, '| hint:', rpcError.hint, '| code:', rpcError.code);
            return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, `RPC: ${rpcError.message} | Code: ${rpcError.code}`);
        }

        logger.info('[submit] RPC result:', JSON.stringify(result));

        if (!result.success) {
            if (result.reason === 'rate_limit_exceeded') {
                logger.warn('[submit] Rate limited!', { ipHash, result: JSON.stringify(result) });
                return error(429, 'تم تجاوز الحد المسموح من المشاركات. يرجى المحاولة لاحقًا.', origin);
            }
            // duplicate goes here, we return success
        }

        return success({ message: 'تم استلام مشاركتك. جزاك الله خيرًا.' }, origin);

    } catch (err) {
        logger.error('[submit] Unexpected error:', err.message, err.stack);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
