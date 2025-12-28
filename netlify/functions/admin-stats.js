/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/admin-stats
 * Returns submission statistics
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabase,
    success,
    error,
    handleOptions,
    validateAdmin,
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
    if (!validateAdmin(event)) {
        return error(401, 'غير مصرح بالوصول', origin);
    }

    try {
        // Get counts by status using separate queries
        const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
            supabase
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'Pending'),
            supabase
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'Approved'),
            supabase
                .from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'Rejected'),
        ]);

        return success({
            stats: {
                pending: pendingResult.count || 0,
                approved: approvedResult.count || 0,
                rejected: rejectedResult.count || 0,
            },
        }, origin);

    } catch (err) {
        console.error('Admin stats error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
