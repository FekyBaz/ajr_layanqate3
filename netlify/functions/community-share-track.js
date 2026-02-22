import { supabase, error, success, handleOptions } from './utils/shared.js';
import { incrementGoalProgress } from './utils/community-goal.js';

const VALID_PLATFORMS = ['whatsapp', 'telegram', 'x', 'native'];
const VISIBLE_STATUSES = ['Approved', 'Posted'];

function sanitizePlatform(value) {
    if (typeof value !== 'string') return 'unknown';
    const normalized = value.trim().toLowerCase();
    return VALID_PLATFORMS.includes(normalized) ? normalized : 'unknown';
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
        const submissionId = Number(payload.submissionId);
        const hasSubmissionId = Number.isInteger(submissionId) && submissionId > 0;

        console.log('[community-share-track] share click', {
            platform,
            hasSubmissionId,
        });

        if (!hasSubmissionId) {
            return success({ tracked: true }, origin, { 'Cache-Control': 'no-store' });
        }

        const { data: row, error: fetchError } = await supabase
            .from('submissions')
            .select('id,post_count,status')
            .eq('id', submissionId)
            .in('status', VISIBLE_STATUSES)
            .maybeSingle();

        if (fetchError) {
            console.error('Share track lookup error:', fetchError.message);
            return success({ tracked: false }, origin, { 'Cache-Control': 'no-store' });
        }

        if (!row) {
            return success({ tracked: false }, origin, { 'Cache-Control': 'no-store' });
        }

        const nextPostCount = (Number(row.post_count) || 0) + 1;
        const { error: updateError } = await supabase
            .from('submissions')
            .update({
                post_count: nextPostCount,
                last_posted_at: new Date().toISOString(),
            })
            .eq('id', submissionId)
            .in('status', VISIBLE_STATUSES);

        if (updateError) {
            console.error('Share track update error:', updateError.message);
            return success({ tracked: false }, origin, { 'Cache-Control': 'no-store' });
        }

        try {
            await incrementGoalProgress(1);
        } catch (goalError) {
            console.error('Share track goal progress error:', goalError.message);
        }

        return success({ tracked: true }, origin, { 'Cache-Control': 'no-store' });
    } catch (err) {
        console.error('Community share track handler error:', err.message);
        return error(500, 'حدث خطأ غير متوقع', origin);
    }
}
