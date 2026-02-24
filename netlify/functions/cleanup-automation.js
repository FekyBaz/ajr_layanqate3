/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/cleanup-automation
 * Scheduled function to purge old records and maintain DB health
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin, cleanupRateLimits, logger, success, error } from './utils/shared.js';

export async function handler(event, context) {
    // Basic auth check if called manually via HTTP
    // Only allow scheduled calls (no httpMethod) or admin calls
    if (event.httpMethod) {
        const adminKey = process.env.ADMIN_API_KEY;
        if (!adminKey) {
            logger.error('[cleanup-automation] ADMIN_API_KEY not configured');
            return error(500, 'Server configuration error');
        }
        const providedKey = event.headers['x-admin-key'];

        if (providedKey !== adminKey) {
            return error(401, 'Unauthorized');
        }
    }

    try {
        logger.info('[cleanup-automation] Starting maintenance tasks...');

        // 1. Cleanup Rate Limits (shared.js helper)
        const rateLimitResult = await cleanupRateLimits();

        // 2. Cleanup View Events (using the RPC defined in 010 migration)
        const { error: viewEventsError, data: viewEventsCount } = await supabaseAdmin
            .rpc('cleanup_view_events', { hours_cutoff: 48 }); // Keep 48 hours of view history

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
        });

    } catch (err) {
        logger.error('[cleanup-automation] Critical failure:', err.message);
        return error(500, 'Maintenance cycle failed');
    }
}
