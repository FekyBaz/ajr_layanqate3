import { supabaseAdmin, VISIBLE_STATUSES, logger } from './shared.js';

function getTodayDateKey() {
    return new Date().toISOString().slice(0, 10);
}

function getDayOffset(dateKey, total) {
    if (!total) return 0;
    const base = Number(dateKey.replaceAll('-', '')) || Date.now();
    return Math.abs(base) % total;
}

async function selectCandidateSubmission(dateKey) {
    const { count, error: countError } = await supabaseAdmin
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .in('status', VISIBLE_STATUSES);

    if (countError) {
        logger.error('Daily feature count error:', countError.message);
        throw countError;
    }

    if (!count) {
        return null;
    }

    const offset = getDayOffset(dateKey, count);

    const { data, error: fetchError } = await supabaseAdmin
        .from('submissions')
        .select('id,message,corrected_message,author_name,content_type,post_count,created_at')
        .in('status', VISIBLE_STATUSES)
        .order('created_at', { ascending: true })
        .range(offset, offset)
        .maybeSingle();

    if (fetchError) {
        logger.error('Daily feature candidate error:', fetchError.message);
        throw fetchError;
    }

    return data;
}

export async function getDailyFeatureWithSubmission(today = getTodayDateKey()) {
    const { data: existing, error: fetchError } = await supabaseAdmin
        .from('daily_feature')
        .select('id,date,submission_id')
        .eq('date', today)
        .maybeSingle();

    if (fetchError) {
        logger.error('Daily feature fetch error:', fetchError.message);
        throw fetchError;
    }

    if (existing?.submission_id) {
        const { data: submission, error: subError } = await supabaseAdmin
            .from('submissions')
            .select('id,message,corrected_message,author_name,content_type,post_count,created_at')
            .eq('id', existing.submission_id)
            .in('status', VISIBLE_STATUSES)
            .maybeSingle();

        if (subError) {
            logger.error('Daily feature submission fetch error:', subError.message);
        }

        if (submission) {
            return { feature: existing, submission };
        }
    }

    const candidate = await selectCandidateSubmission(today);

    if (!candidate) {
        return null;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
        .from('daily_feature')
        .upsert({ date: today, submission_id: candidate.id }, { onConflict: 'date' })
        .select('id,date,submission_id')
        .maybeSingle();

    if (insertError) {
        logger.error('Daily feature upsert error:', insertError.message);
    }

    return {
        feature: inserted || { date: today, submission_id: candidate.id },
        submission: candidate,
    };
}
