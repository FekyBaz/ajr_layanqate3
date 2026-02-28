import { supabaseAdmin, VISIBLE_STATUSES, logger, success, error } from './utils/shared.js';

export const config = {
    schedule: '0 * * * *',
};

export async function handler() {
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
