import { supabase } from './utils/shared.js';

const VISIBLE_STATUSES = ['Approved', 'Posted'];

export const config = {
    schedule: '0 * * * *',
};

export async function handler() {
    try {
        const { data, error: aggregateError } = await supabase
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

        const { error: upsertError } = await supabase
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

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                totalVisible,
                totalPostCount,
                averagePostCount,
            }),
        };
    } catch (err) {
        console.error('community-stats-refresh failed:', err.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: 'Failed to refresh community stats' }),
        };
    }
}
