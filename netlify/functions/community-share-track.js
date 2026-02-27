import { supabaseAdmin, error, success, handleOptions, logger } from './utils/shared.js';
import { incrementGoalProgress } from './utils/community-goal.js';

const VALID_PLATFORMS = ['whatsapp', 'telegram', 'x', 'native'];
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizePlatform(value) {
    if (typeof value !== 'string') return 'unknown';
    const normalized = value.trim().toLowerCase();
    return VALID_PLATFORMS.includes(normalized) ? normalized : 'unknown';
}

function sanitizeSubmissionId(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return UUID_V4_REGEX.test(normalized) ? normalized : null;
}

export async function handler(event) {
    const origin = event.headers.origin || event.headers.Origin;

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'POST') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        let payload;
        try {
            payload = JSON.parse(event.body || '{}');
        } catch {
            return error(400, 'Invalid payload', origin);
        }

        const platform = sanitizePlatform(payload.platform);
        const submissionId = sanitizeSubmissionId(payload.submissionId);
        const hasSubmissionId = Boolean(submissionId);

        logger.info('[community-share-track] share click', {
            platform,
            hasSubmissionId,
        });

        if (!hasSubmissionId) {
            return success({ tracked: true }, origin, { 'Cache-Control': 'no-store' });
        }

        // Use atomic RPC to increment post_count — no more read-modify-write race condition
        const { data: newCount, error: rpcError } = await supabaseAdmin
            .rpc('increment_post_count', { p_submission_id: submissionId });

        if (rpcError) {
            logger.error('Share track RPC error:', rpcError.message);
            return success({ tracked: false }, origin, { 'Cache-Control': 'no-store' });
        }

        if (newCount === null || newCount === undefined) {
            // Submission not found or not visible
            return success({ tracked: false }, origin, { 'Cache-Control': 'no-store' });
        }

        try {
            await incrementGoalProgress(1);
        } catch (goalError) {
            logger.error('Share track goal progress error:', goalError.message);
        }

        return success({ tracked: true }, origin, { 'Cache-Control': 'no-store' });
    } catch (err) {
        logger.error('Community share track handler error:', err.message);
        return error(500, 'حدث خطأ غير متوقع', origin);
    }
}
