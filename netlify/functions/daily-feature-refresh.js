import { error, success, getTodayDateKey, logger } from './utils/shared.js';
import { getDailyFeatureWithSubmission } from './utils/daily-feature.js';
import { getOrCreateGoal } from './utils/community-goal.js';

export async function handler(event) {
    if (event.httpMethod && event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed');
    }

    try {
        const today = getTodayDateKey();
        const [dailyFeature, goal] = await Promise.all([
            getDailyFeatureWithSubmission(today),
            getOrCreateGoal(today),
        ]);

        logger.info('[daily-feature-refresh] completed', {
            date: today,
            dailyFeatureId: dailyFeature?.id || null,
            submissionId: dailyFeature?.submission_id || null,
            goalId: goal?.id || null,
            dailyTarget: goal?.daily_target || null,
        });

        return success({
            refreshed: true,
            date: today,
            dailyFeature: dailyFeature ? {
                id: dailyFeature.id,
                submissionId: dailyFeature.submission_id,
            } : null,
            goal: goal ? {
                id: goal.id,
                dailyTarget: goal.daily_target,
                currentProgress: goal.current_progress,
            } : null,
        });
    } catch (refreshError) {
        console.error('[daily-feature-refresh] failed', refreshError.message);
        return error(500, 'Failed to refresh daily rhythm');
    }
}
