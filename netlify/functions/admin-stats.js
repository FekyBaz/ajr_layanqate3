/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-stats
 * Returns submission statistics
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
} from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    // Validate admin authentication
    const authResult = await validateAdminWithRateLimit(event);
    if (!authResult.valid) {
        return error(401, 'غير مصرح بالوصول', origin);
    }
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }

    try {
        // Get counts by status using separate queries
        const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
            supabaseAdmin
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('status', STATUS.PENDING),
            supabaseAdmin
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('status', STATUS.APPROVED),
            supabaseAdmin
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('status', STATUS.REJECTED),
        ]);

        return success({
            stats: {
                pending: pendingResult.count || 0,
                approved: approvedResult.count || 0,
                rejected: rejectedResult.count || 0,
            },
        }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
