/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/admin-memory-update-approve
 * Approve and merge a proposed memory update (admin only)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    validateAdminWithRateLimit,
    STATUS,
    logger,
    sanitizeLegacyText,
    sanitizeExternalLinks
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

    // Validate admin authentication
    const authResult = await validateAdminWithRateLimit(event);
    // 429 first: brute-force floods are rate-limited even with wrong keys (#76)
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
    }

    try {
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const { id, biography, good_traits, ongoing_charity, external_links, story } = body;

        if (!id || typeof id !== 'string') {
            return error(400, 'معرف الاقتراح مطلوب', origin);
        }

        // Fetch current proposal state
        const { data: proposal, error: fetchError } = await supabaseAdmin
            .from('memory_updates')
            .select('*')
            .eq('id', id)
            .eq('status', STATUS.PENDING)
            .maybeSingle();

        if (fetchError) {
            logger.error('admin-memory-update-approve fetch proposal error:', fetchError.message);
            return error(500, 'خطأ في جلب بيانات الاقتراح', origin, fetchError.message);
        }

        if (!proposal) {
            return error(404, 'الاقتراح غير موجود أو تم البت فيه مسبقًا', origin);
        }

        // Prepare the merged fields. If admin sends modified values, use them; otherwise, use proposed values.
        let finalBio = biography !== undefined ? biography : proposal.biography;
        let finalTraits = good_traits !== undefined ? good_traits : proposal.good_traits;
        let finalCharity = ongoing_charity !== undefined ? ongoing_charity : proposal.ongoing_charity;
        let finalLinks = external_links !== undefined ? external_links : proposal.external_links;
        let finalStory = story !== undefined ? story : proposal.story;

        // Perform server side sanitization on the merged/modified values
        const bioResult = sanitizeLegacyText(finalBio, 3, 1000, false);
        if (!bioResult.isValid) return error(400, `نبذة عن المتوفى: ${bioResult.error}`, origin);

        const traitsResult = sanitizeLegacyText(finalTraits, 3, 500, false);
        if (!traitsResult.isValid) return error(400, `صفات المتوفى: ${traitsResult.error}`, origin);

        const charityResult = sanitizeLegacyText(finalCharity, 3, 1000, false);
        if (!charityResult.isValid) return error(400, `الصدقة الجارية: ${charityResult.error}`, origin);

        const storyResult = sanitizeLegacyText(finalStory, 3, 2000, false);
        if (!storyResult.isValid) return error(400, `مواقف مؤثرة: ${storyResult.error}`, origin);

        const linksResult = sanitizeExternalLinks(finalLinks);
        if (!linksResult.isValid) {
            return error(400, linksResult.error, origin);
        }

        // 1. Update memory page content
        const { error: memoryUpdateError } = await supabaseAdmin
            .from('memories')
            .update({
                biography: bioResult.sanitized,
                good_traits: traitsResult.sanitized,
                ongoing_charity: charityResult.sanitized,
                external_links: linksResult.links,
                story: storyResult.sanitized,
                last_activity_at: new Date().toISOString()
            })
            .eq('id', proposal.memory_id);

        if (memoryUpdateError) {
            logger.error('admin-memory-update-approve memories table update error:', memoryUpdateError.message);
            return error(500, 'فشل تحديث صفحة المتوفى في قاعدة البيانات', origin, memoryUpdateError.message);
        }

        // 2. Mark proposal as Approved and save the final merged values (e.g. if the admin modified them)
        const { error: proposalUpdateError } = await supabaseAdmin
            .from('memory_updates')
            .update({
                status: STATUS.APPROVED,
                reviewed_at: new Date().toISOString(),
                biography: bioResult.sanitized,
                good_traits: traitsResult.sanitized,
                ongoing_charity: charityResult.sanitized,
                external_links: linksResult.links,
                story: storyResult.sanitized
            })
            .eq('id', id);

        if (proposalUpdateError) {
            logger.error('admin-memory-update-approve memory_updates table update error:', proposalUpdateError.message);
            // This is non-fatal for memories table but we should log it
            return error(500, 'تم تحديث الصفحة ولكن فشل تحديث حالة الاقتراح', origin, proposalUpdateError.message);
        }

        logger.info(`[admin] Memory update approved and merged successfully. Proposal: ${id}, Memory: ${proposal.memory_id}`);

        return success({
            message: 'تم اعتماد ودمج التغييرات المقترحة بنجاح.',
            proposal_id: id,
            memory_id: proposal.memory_id
        }, origin);

    } catch (err) {
        logger.error('admin-memory-update-approve unexpected error:', err.message);
        return error(500, 'حدث خطأ غير متوقع. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
