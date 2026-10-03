/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/memory-update-propose
 * Propose an update/enrichment to an existing approved memorial page (no login required)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    sanitizeName,
    sanitizeLegacyText,
    sanitizeExternalLinks,
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
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const {
            memory_id,
            proposed_by_name,
            proposed_by_relation,
            biography,
            good_traits,
            ongoing_charity,
            external_links,
            story
        } = body;

        // Validate memory_id (required uuid)
        if (!memory_id || typeof memory_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memory_id)) {
            return error(400, 'معرف الصفحة غير صالح', origin);
        }

        // Validate editor name & relation
        const nameResult = sanitizeName(proposed_by_name);
        if (!nameResult || nameResult.length < 3 || nameResult.length > 100) {
            return error(400, 'الاسم المقترح للتعديل مطلوب (بين ٣ إلى ١٠٠ حرف)', origin);
        }

        const relationResult = sanitizeName(proposed_by_relation);
        if (!relationResult || relationResult.length < 3 || relationResult.length > 100) {
            return error(400, 'العلاقة بالمتوفى مطلوبة (بين ٣ إلى ١٠٠ حرف)', origin);
        }

        // Validate structured fields
        const bioResult = sanitizeLegacyText(biography, 3, 1000, false);
        if (!bioResult.isValid) return error(400, `نبذة عن المتوفى: ${bioResult.error}`, origin);

        const traitsResult = sanitizeLegacyText(good_traits, 3, 500, false);
        if (!traitsResult.isValid) return error(400, `صفات المتوفى: ${traitsResult.error}`, origin);

        const charityResult = sanitizeLegacyText(ongoing_charity, 3, 1000, false);
        if (!charityResult.isValid) return error(400, `الصدقة الجارية: ${charityResult.error}`, origin);

        const storyResult = sanitizeLegacyText(story, 3, 2000, false);
        if (!storyResult.isValid) return error(400, `مواقف مؤثرة: ${storyResult.error}`, origin);

        // Validate external links
        const linksResult = sanitizeExternalLinks(external_links);
        if (!linksResult.isValid) {
            return error(400, linksResult.error, origin);
        }

        // Hash client IP for rate limiting (single salted hashIP)
        const clientIP = getClientIP(event);
        const ipHash = hashIP(clientIP);

        // Call database RPC
        const { data: result, error: rpcError } = await supabaseAdmin.rpc('propose_memory_update', {
            p_memory_id: memory_id,
            p_proposed_by_name: nameResult,
            p_proposed_by_relation: relationResult,
            p_biography: bioResult.sanitized,
            p_good_traits: traitsResult.sanitized,
            p_ongoing_charity: charityResult.sanitized,
            p_external_links: linksResult.links,
            p_story: storyResult.sanitized,
            p_ip_hash: ipHash,
            p_rate_limit_max: config.memoryUpdateRateLimitMax,
            p_rate_limit_hours: config.memoryUpdateRateLimitHours,
        });

        if (rpcError) {
            logger.error('propose_memory_update RPC error:', rpcError.message, rpcError.code);
            return error(500, 'خطأ أثناء إرسال اقتراح التعديل لقاعدة البيانات', origin, rpcError.message);
        }

        if (!result.success) {
            if (result.reason === 'rate_limit_exceeded') {
                return error(429, 'تم تجاوز الحد الأقصى لاقتراحات التعديل المسموح بها لهذا اليوم (٥ تعديلات كحد أقصى).', origin);
            }
            if (result.reason === 'memory_not_found_or_unapproved') {
                return error(404, 'الصفحة المراد تعديلها غير موجودة أو لم يتم تفعيلها بعد.', origin);
            }
            if (result.reason === 'payload_too_large') {
                return error(400, 'حجم التعديل المقترح يتجاوز الحد المسموح به.', origin);
            }
            if (result.reason === 'invalid_editor_info') {
                return error(400, 'بيانات مقدم التعديل غير صالحة.', origin);
            }
            return error(500, 'فشل إرسال التعديل.', origin, `RPC reason: ${result.reason}`);
        }

        return success({
            message: 'تم إرسال اقتراح التعديل بنجاح، وسيتم مراجعته واعتماده من قبل الإدارة في أقرب وقت إن شاء الله.',
            proposal_id: result.proposal_id,
        }, origin);

    } catch (err) {
        logger.error('memory-update-propose unexpected error:', err.message, err.stack);
        return error(500, 'خطأ غير متوقع في الخادم.', origin, err.message);
    }
}
