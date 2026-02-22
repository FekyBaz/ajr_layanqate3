import { supabase } from './shared.js';

const VISIBLE_STATUSES = ['Approved', 'Posted'];

function getTodayDateKey() {
    return new Date().toISOString().slice(0, 10);
}

function getDayOffset(dateKey, total) {
    if (!total) return 0;
    const base = Number(dateKey.replaceAll('-', '')) || Date.now();
    return Math.abs(base) % total;
}

async function selectCandidateSubmission(dateKey) {
    const { count, error: countError } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .in('status', VISIBLE_STATUSES);

    if (countError) throw countError;

    const total = count || 0;
    if (!total) return null;

    const offset = getDayOffset(dateKey, total);
    const { data, error: fetchError } = await supabase
        .from('submissions')
        .select('id')
        .in('status', VISIBLE_STATUSES)
        .order('created_at', { ascending: false })
        .range(offset, offset)
        .maybeSingle();

    if (fetchError) throw fetchError;
    return data?.id || null;
}

export async function getOrCreateDailyFeature(today = getTodayDateKey()) {
    const { data: existing, error: fetchError } = await supabase
        .from('daily_feature')
        .select('id,submission_id,date,created_at')
        .eq('date', today)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return existing;

    const submissionId = await selectCandidateSubmission(today);
    if (!submissionId) return null;

    const { data: created, error: createError } = await supabase
        .from('daily_feature')
        .insert({ date: today, submission_id: submissionId })
        .select('id,submission_id,date,created_at')
        .single();

    if (createError) {
        const isUniqueConflict = String(createError.code || '') === '23505';
        if (isUniqueConflict) {
            const { data: retryData, error: retryError } = await supabase
                .from('daily_feature')
                .select('id,submission_id,date,created_at')
                .eq('date', today)
                .maybeSingle();
            if (retryError) throw retryError;
            if (retryData) return retryData;
        }

        throw createError;
    }

    return created;
}

export async function getDailyFeatureWithSubmission(today = getTodayDateKey()) {
    const feature = await getOrCreateDailyFeature(today);
    if (!feature?.submission_id) return null;

    const { data: submission, error } = await supabase
        .from('submissions')
        .select('id,message,corrected_message,author_name,content_type,created_at,post_count,status')
        .eq('id', feature.submission_id)
        .in('status', VISIBLE_STATUSES)
        .maybeSingle();

    if (error) throw error;

    if (!submission) return null;

    return {
        ...feature,
        submission,
    };
}
