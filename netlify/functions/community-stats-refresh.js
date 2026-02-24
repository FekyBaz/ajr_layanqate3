import { supabaseAdmin, VISIBLE_STATUSES, logger, success, error } from './utils/shared.js';

export const config = {
    schedule: '0 * * * *',
};

export async function handler() {
    try {
        const { data, error: aggregateError } = await supabaseAdmin
            .from('submissions')
            .select('status,post_count')
            .in('status', VISIBLE_STATUSES);

        if (aggregateError) {
            throw aggregateError;
        }

        const visibleRows = (data || []).filter((row) => VISIBLE_STATUSES.includes(row.status));
        const totalVisible = visibleRows.length;
        const totalPostCount = visibleRows.reduce((sum, row) => sum + (Number(row.post_count) || 0), 0);
        const averagePostCount = totalVisible ? totalPostCount / totalVisible : 0;

        const { error: upsertError } = await supabaseAdmin
            .from('community_stats')
            .upsert({
                id: 1,
                total_approved: totalVisible,
                total_post_count: totalPostCount,
                average_post_count: averagePostCount,
                updated_at: new Date().toISOString(),
            });

        if (upsertError) {
            throw upsertError;
        }

        return success({
            totalVisible,
            totalPostCount,
            averagePostCount,
        });
    } catch (err) {
        logger.error('community-stats-refresh failed:', err.message);
        return error(500, 'Failed to refresh community stats');
    }
}
