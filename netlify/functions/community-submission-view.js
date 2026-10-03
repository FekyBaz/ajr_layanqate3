import { supabaseAdmin, error, success, handleOptions, hashIP, getClientIP, checkRateLimit, recordRequest, HOT_ENDPOINT_RATE_LIMITS, getCorsHeaders, logger } from './utils/shared.js';

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

        // Submission IDs are UUIDs (see submissions table + record_and_increment_view RPC).
        // The previous Number() check rejected every real ID with 400 (#78).
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const rawId = typeof payload.submissionId === 'string' ? payload.submissionId.trim() : '';
        const submissionId = UUID_REGEX.test(rawId) ? rawId.toLowerCase() : null;

        if (!submissionId) {
            return error(400, 'Invalid submission id', origin);
        }

        // Hash the client IP (single salted hashIP shared by all writers)
        const clientIP = getClientIP(event);
        const ipHash = hashIP(clientIP);

        // View pings were previously unlimited (#77)
        const allowed = await checkRateLimit(clientIP, 'view', HOT_ENDPOINT_RATE_LIMITS.view);
        if (!allowed) {
            return error(429, 'تم تجاوز الحد المسموح، يرجى المحاولة لاحقًا.', origin);
        }
        await recordRequest(clientIP, 'view');

        // Use atomic RPC with database-backed deduplication
        // This replaces the old in-memory Map throttling + read-modify-write counter
        const { data, error: rpcError } = await supabaseAdmin
            .rpc('record_and_increment_view', {
                p_submission_id: submissionId,
                p_ip_hash: ipHash,
                p_debounce_seconds: 60,
            });

        if (rpcError) {
            logger.error('View counter RPC error:', rpcError.message);
            return error(500, 'تعذر تحديث عدد المشاهدات', origin);
        }

        if (!data || !data.recorded) {
            // Debounced or not found — return 204 No Content
            return {
                statusCode: 204,
                headers: {
                    ...getCorsHeaders(origin),
                    'Cache-Control': 'no-store',
                },
                body: '',
            };
        }

        return success({ updated: true, views: data.views }, origin, {
            'Cache-Control': 'no-store',
        });
    } catch (err) {
        logger.error('Community submission view handler error:', err.message);
        return error(500, 'حدث خطأ غير متوقع', origin);
    }
}
