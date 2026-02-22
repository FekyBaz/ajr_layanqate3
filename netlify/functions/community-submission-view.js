import { supabase, error, success, handleOptions } from './utils/shared.js';

export async function handler(event) {
    const origin = event.headers.origin || event.headers.Origin;

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'POST') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        const submissionId = Number(payload.submissionId);

        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return error(400, 'Invalid submission id', origin);
        }

        const { data: existing, error: existingError } = await supabase
            .from('submissions')
            .select('id,views,status')
            .eq('id', submissionId)
            .eq('status', 'Approved')
            .maybeSingle();

        if (existingError) {
            console.error('View counter lookup error:', existingError.message);
            return error(500, 'تعذر تحديث عدد المشاهدات', origin);
        }

        if (!existing) {
            return error(404, 'Submission not found', origin);
        }

        const nextViews = (Number(existing.views) || 0) + 1;

        const { error: updateError } = await supabase
            .from('submissions')
            .update({ views: nextViews })
            .eq('id', submissionId)
            .eq('status', 'Approved');

        if (updateError) {
            console.error('View counter update error:', updateError.message);
            return error(500, 'تعذر تحديث عدد المشاهدات', origin);
        }

        return success({ updated: true }, origin);
    } catch (err) {
        console.error('Community submission view handler error:', err.message);
        return error(500, 'حدث خطأ غير متوقع', origin);
    }
}
