import { supabase } from './shared.js';

const DEFAULT_DAILY_TARGET = 200;

function getTodayDateKey() {
    return new Date().toISOString().slice(0, 10);
}

export async function getOrCreateGoal(today = getTodayDateKey()) {
    const { data: existing, error: fetchError } = await supabase
        .from('community_goal')
        .select('id,daily_target,current_progress,date,updated_at')
        .eq('date', today)
        .maybeSingle();

    if (fetchError) {
        throw fetchError;
    }

    if (existing) return existing;

    const { data: created, error: createError } = await supabase
        .from('community_goal')
        .insert({
            date: today,
            daily_target: DEFAULT_DAILY_TARGET,
            current_progress: 0,
        })
        .select('id,daily_target,current_progress,date,updated_at')
        .single();

    if (createError) {
        const isUniqueConflict = String(createError.code || '') === '23505';
        if (isUniqueConflict) {
            const { data: retryData, error: retryError } = await supabase
                .from('community_goal')
                .select('id,daily_target,current_progress,date,updated_at')
                .eq('date', today)
                .maybeSingle();

            if (retryError) {
                throw retryError;
            }

            if (retryData) return retryData;
        }

        throw createError;
    }

    return created;
}

export async function incrementGoalProgress(incrementBy = 1) {
    const amount = Number.isInteger(incrementBy) && incrementBy > 0 ? incrementBy : 1;
    const goal = await getOrCreateGoal();
    const nextProgress = (Number(goal.current_progress) || 0) + amount;

    const { data, error } = await supabase
        .from('community_goal')
        .update({
            current_progress: nextProgress,
            updated_at: new Date().toISOString(),
        })
        .eq('id', goal.id)
        .select('id,daily_target,current_progress,date,updated_at')
        .single();

    if (error) {
        throw error;
    }

    return data;
}
