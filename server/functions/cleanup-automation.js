/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/cleanup-automation
 * Scheduled function to purge old records and maintain DB health
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin, cleanupRateLimits, logger, success, error, requireScheduledOrAdmin } from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers?.origin || '';
    // Scheduled calls (no httpMethod) pass; manual calls need the admin key.
    // Uses constant-time comparison via validateAdmin (see shared.js).
    const denied = requireScheduledOrAdmin(event, origin, 'cleanup-automation');
    if (denied) return denied;

    try {
        logger.info('[cleanup-automation] Starting maintenance tasks...');

        // 1. Cleanup Rate Limits (shared.js helper)
        const rateLimitResult = await cleanupRateLimits();

        // 2. Cleanup View Events (using the RPC defined in 010 migration)
        const { error: viewEventsError, data: viewEventsCount } = await supabaseAdmin
            .rpc('cleanup_view_events', { p_older_than_hours: 48 }); // Keep 48 hours of view history

        if (viewEventsError) {
            logger.error('[cleanup-automation] view_events cleanup failed:', viewEventsError.message);
        } else {
            logger.info('[cleanup-automation] view_events cleanup successful', { removed: viewEventsCount });
        }

        // 3. Cleanup old stats snapshots (optional, if we decide to keep history)
        // ...

        return success({
            maintenance: 'completed',
            stats: {
                rateLimitsDeleted: rateLimitResult.count || 0,
                viewEventsDeleted: viewEventsCount || 0,
            }
        }, origin);

    } catch (err) {
        logger.error('[cleanup-automation] Critical failure:', err.message);
        return error(500, 'Maintenance cycle failed', origin);
    }
}
