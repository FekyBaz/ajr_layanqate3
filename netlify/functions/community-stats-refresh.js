import { supabaseAdmin, VISIBLE_STATUSES, logger, success, error, requireScheduledOrAdmin } from './utils/shared.js';

export const config = {
    schedule: '0 * * * *',
};

export async function handler(event = {}) {
    const denied = requireScheduledOrAdmin(event, event.headers?.origin || '', 'community-stats-refresh');
    if (denied) return denied;

    try {
        const { data, error: rpcError } = await supabaseAdmin.rpc('refresh_community_stats');

        if (rpcError) {
            throw rpcError;
        }

        return success(data);
    } catch (err) {
        logger.error('community-stats-refresh failed:', err.message);
        return error(500, 'Failed to refresh community stats');
    }
}
