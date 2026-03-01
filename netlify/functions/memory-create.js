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
    sanitizeLegacyText,
    sanitizeExternalLinks,
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

        const { deceased_name, relation, biography, good_traits, ongoing_charity, external_links, story } = body;

        // Validate deceased_name (required)
        const nameResult = sanitizeName(deceased_name);
        if (!nameResult) {
            return error(400, 'اسم المتوفى مطلوب', origin);
        }

        // Validate structured text fields
        const bioResult = sanitizeLegacyText(biography, 3, 1000, true);
        if (!bioResult.isValid) return error(400, `نبذة عن المتوفى: ${bioResult.error}`, origin);

        const traitsResult = sanitizeLegacyText(good_traits, 3, 500, false);
        if (!traitsResult.isValid) return error(400, `صفات المتوفى: ${traitsResult.error}`, origin);

        const charityResult = sanitizeLegacyText(ongoing_charity, 3, 1000, false);
        if (!charityResult.isValid) return error(400, `الصدقة الجارية: ${charityResult.error}`, origin);

        const storyResult = sanitizeLegacyText(story, 3, 2000, false);
        if (!storyResult.isValid) return error(400, `مواقف مؤثرة: ${storyResult.error}`, origin);

        // Validate external links array
        const linksResult = sanitizeExternalLinks(external_links);
        if (!linksResult.isValid) {
            return error(400, linksResult.error, origin);
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
            p_biography: bioResult.sanitized,
            p_good_traits: traitsResult.sanitized,
            p_ongoing_charity: charityResult.sanitized,
            p_external_links: linksResult.links,
            p_story: storyResult.sanitized,
            p_ip_hash: ipHash,
            p_rate_limit_max: parseInt(process.env.MEMORY_RATE_LIMIT_MAX || '3', 10),
            p_rate_limit_hours: parseInt(process.env.MEMORY_RATE_LIMIT_HOURS || '24', 10),
        });

        if (rpcError) {
            logger.error('create_memory RPC error:', rpcError.message, rpcError.details, rpcError.hint, rpcError.code);
            return error(500, 'خطأ في قاعدة البيانات أثناء إنشاء الصفحة', origin, `RPC: ${rpcError.message} | Code: ${rpcError.code}`);
        }

        if (!result.success) {
            if (result.reason === 'rate_limit_exceeded') {
                return error(429, 'تم تجاوز الحد المسموح. يرجى المحاولة لاحقًا.', origin);
            }
            if (result.reason === 'slug_generation_failed') {
                logger.error('Slug generation failed after max retries');
                return error(500, 'فشل في توليد رابط الصفحة. يرجى المحاولة مرة أخرى.', origin);
            }
            if (result.reason === 'payload_too_large') {
                return error(400, 'حجم المحتوى يتجاوز الحد المسموح.', origin);
            }
            return error(500, 'خطأ غير متوقع في الخادم.', origin, `RPC reason: ${result.reason}`);
        }

        return success({
            message: 'تم استلام طلبك. ستتم مراجعته قريبًا إن شاء الله.',
            slug: result.slug,
        }, origin);

    } catch (err) {
        logger.error('memory-create unexpected error:', err.message, err.stack);
        return error(500, 'خطأ في إعداد الخادم. يرجى التواصل مع الدعم.', origin, err.message);
    }
}
