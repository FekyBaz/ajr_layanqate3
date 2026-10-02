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
    // 429 first: brute-force floods are rate-limited even with wrong keys (#76)
    if (authResult.rateLimited) {
        return error(429, 'تم تجاوز الحد المسموح للمحاولات', origin);
    }
    if (!authResult.valid) {
        return error(401, 'بيانات تسجيل الدخول غير صحيحة', origin, 'Admin key validation failed');
    }

    try {
        // Use the aggregation RPC if available (defined in old api/migrations/014_phase2_engagement.sql)
        // Fall back to individual count queries if RPC doesn't exist
        const { data: stats, error: rpcError } = await supabaseAdmin.rpc('get_submission_stats');

        if (rpcError) {
            if (rpcError.code === 'PGRST202' || rpcError.message?.includes('not found') || rpcError.message?.includes('does not exist') || rpcError.message?.includes('function')) {
                // RPC function doesn't exist — fall back to direct queries
                logger.warn('[admin-stats] get_submission_stats RPC not found, falling back to direct counts');

                const [{ count: pending }, { count: approved }, { count: rejected }] = await Promise.all([
                    supabaseAdmin.from('submissions').select('id', { head: true, count: 'exact', })
                        .eq('status', STATUS.PENDING),
                    supabaseAdmin.from('submissions').select('id', { head: true, count: 'exact', })
                        .eq('status', STATUS.APPROVED),
                    supabaseAdmin.from('submissions').select('id', { head: true, count: 'exact', })
                        .eq('status', STATUS.REJECTED),
                ]);

                return success({
                    stats: { pending: pending || 0, approved: approved || 0, rejected: rejected || 0 },
                }, origin);
            }

            logger.error('admin-stats RPC error:', rpcError.message, rpcError.code);
            return error(500, 'فشل الاتصال بقاعدة البيانات', origin, rpcError.message);
        }

        return success({
            stats: {
                pending: stats.pending || 0,
                approved: stats.approved || 0,
                rejected: stats.rejected || 0,
            },
        }, origin);

    } catch (err) {
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin, err.message);
    }
}
