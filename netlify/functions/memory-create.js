/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/memory-create
 * Create a new memorial page (صدقة جارية على روح متوفى)
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

        const { deceased_name, relation, message } = body;

        // Validate deceased_name (required)
        const nameResult = sanitizeName(deceased_name);
        if (!nameResult) {
            return error(400, 'اسم المتوفى مطلوب', origin);
        }

        // Validate message (required, Arabic-only)
        const messageResult = sanitizeMessage(message);
        if (!messageResult.isValid) {
            return error(400, messageResult.error, origin);
        }

        // Sanitize relation (optional)
        const sanitizedRelation = relation ? sanitizeName(relation) : null;

        // Hash client IP
        const clientIP = getClientIP(event);
        const ipHash = crypto
            .createHash('sha256')
            .update((clientIP || 'unknown') + (process.env.IP_SALT || ''))
            .digest('hex')
            .substring(0, 32);

        // Call atomic RPC
        const { data: result, error: rpcError } = await supabaseAdmin.rpc('create_memory', {
            p_deceased_name: nameResult,
            p_relation: sanitizedRelation,
            p_message: messageResult.sanitized,
            p_ip_hash: ipHash,
            p_rate_limit_max: parseInt(process.env.MEMORY_RATE_LIMIT_MAX || '3', 10),
            p_rate_limit_hours: parseInt(process.env.MEMORY_RATE_LIMIT_HOURS || '24', 10),
        });

        if (rpcError) {
            logger.error('create_memory RPC error:', rpcError.message);
            return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
        }

        if (!result.success) {
            if (result.reason === 'rate_limit_exceeded') {
                return error(429, 'تم تجاوز الحد المسموح. يرجى المحاولة لاحقًا.', origin);
            }
            if (result.reason === 'slug_generation_failed') {
                logger.error('Slug generation failed after max retries');
                return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
            }
            return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
        }

        return success({
            message: 'تم استلام طلبك. ستتم مراجعته قريبًا إن شاء الله.',
            slug: result.slug,
        }, origin);

    } catch (err) {
        logger.error('memory-create unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
