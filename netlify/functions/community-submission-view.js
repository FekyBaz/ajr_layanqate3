import { supabase, error, success, handleOptions, getClientIP, getCorsHeaders } from './utils/shared.js';

const VIEW_DEBOUNCE_WINDOW_MS = 60_000;
const VISIBLE_STATUSES = ['Approved', 'Posted'];
const viewTracker = new Map();

function getThrottleKey(clientIP, submissionId) {
    if (clientIP && clientIP !== 'unknown') {
        return `${clientIP}:${submissionId}`;
    }

    return `unknown-ip:${submissionId}`;
}

function canRecordView(clientIP, submissionId) {
    const now = Date.now();
    const key = getThrottleKey(clientIP, submissionId);
    const previous = viewTracker.get(key) || 0;

    if (now - previous < VIEW_DEBOUNCE_WINDOW_MS) {
        return false;
    }

    viewTracker.set(key, now);

    if (viewTracker.size > 10_000) {
        for (const [entryKey, timestamp] of viewTracker.entries()) {
            if (now - timestamp > VIEW_DEBOUNCE_WINDOW_MS * 2) {
                viewTracker.delete(entryKey);
            }
        }
    }

    return true;
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

        const submissionId = Number(payload.submissionId);

        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return error(400, 'Invalid submission id', origin);
        }

        const clientIP = getClientIP(event);
        if (!canRecordView(clientIP, submissionId)) {
            return {
                statusCode: 204,
                headers: {
                    ...getCorsHeaders(origin),
                    'Cache-Control': 'no-store',
                },
                body: '',
            };
        }

        const { data: existing, error: existingError } = await supabase
            .from('submissions')
            .select('id,views,status')
            .eq('id', submissionId)
            .in('status', VISIBLE_STATUSES)
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
            .in('status', VISIBLE_STATUSES);

        if (updateError) {
            console.error('View counter update error:', updateError.message);
            return error(500, 'تعذر تحديث عدد المشاهدات', origin);
        }

        return success({ updated: true }, origin, {
            'Cache-Control': 'no-store',
        });
    } catch (err) {
        console.error('Community submission view handler error:', err.message);
        return error(500, 'حدث خطأ غير متوقع', origin);
    }
}
