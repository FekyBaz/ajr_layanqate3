import { supabaseAdmin, logger, getTodayDateKey } from './shared.js';

const DEFAULT_DAILY_TARGET = 100;
const TARGET_VARIANCE = 20;

function getDailyTargetForDate(dateKey) {
    const seed = Number(dateKey.replaceAll('-', '')) || 0;
    const variance = (seed % ((TARGET_VARIANCE * 2) + 1)) - TARGET_VARIANCE;
    return DEFAULT_DAILY_TARGET + variance;
}

export async function getOrCreateGoal(today = getTodayDateKey()) {
    const target = getDailyTargetForDate(today);

    const { data: existing, error: fetchError } = await supabaseAdmin
        .from('community_goal')
        .select('id,date,daily_target,current_progress')
        .eq('date', today)
        .maybeSingle();

    if (fetchError) {
        logger.error('Goal fetch error:', fetchError.message);
        throw fetchError;
    }

    if (existing) {
        return existing;
    }

    const { data: created, error: createError } = await supabaseAdmin
        .from('community_goal')
        .insert({
            date: today,
            daily_target: target,
            current_progress: 0,
        })
        .select('id,date,daily_target,current_progress')
        .single();

    if (createError) {
        if (createError.code === '23505') {
            const { data: retry, error: retryError } = await supabaseAdmin
                .from('community_goal')
                .select('id,date,daily_target,current_progress')
                .eq('date', today)
                .maybeSingle();

            if (retryError) {
                logger.error('Goal retry fetch error:', retryError.message);
                throw retryError;
            }

            return retry;
        }

        logger.error('Goal create error:', createError.message);
        throw createError;
    }

    return created;
}

// Atomic goal progress increment via RPC — no more read-modify-write race condition
export async function incrementGoalProgress(amount = 1) {
    const today = getTodayDateKey();

    // Ensure the goal exists first
    await getOrCreateGoal(today);

    const { data: newProgress, error: rpcError } = await supabaseAdmin
        .rpc('increment_goal_progress', {
            p_date: today,
            p_amount: amount,
        });

    if (rpcError) {
        logger.error('Goal progress RPC error:', rpcError.message);
    }

    return newProgress;
}
