import { supabase } from './utils/shared.js';

export const config = {
    schedule: '0 * * * *',
};

export async function handler() {
    try {
        const { data, error: aggregateError, count } = await supabase
            .from('submissions')
            .select('post_count', { count: 'exact' })
            .eq('status', 'Approved');

        if (aggregateError) {
            throw aggregateError;
        }

        const rows = data || [];
        const totalApproved = count || 0;
        const totalPostCount = rows.reduce((sum, row) => sum + (Number(row.post_count) || 0), 0);
        const averagePostCount = totalApproved ? totalPostCount / totalApproved : 0;

        const { error: upsertError } = await supabase
            .from('community_stats')
            .upsert({
                id: 1,
                total_approved: totalApproved,
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
                totalApproved,
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
