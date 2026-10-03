import { createClient } from '@supabase/supabase-js';
import { success, error, handleOptions, logger, getClientIP, checkRateLimit, recordRequest, HOT_ENDPOINT_RATE_LIMITS } from './utils/shared.js';

const FATIHA_ROW_ID = 1;
const FATIHA_TABLE = 'fatiha_counter';

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function getCurrentCount(supabase) {
  const { data, error } = await supabase
    .from(FATIHA_TABLE)
    .select('count')
    .eq('id', FATIHA_ROW_ID)
    .single();

  if (error) throw error;

  return Number(data?.count) || 0;
}

export async function handler(event) {
  const origin = event.headers.origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(origin);
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return error(405, 'Method not allowed', origin);
  }

  // Writes were previously unlimited (read-modify-write counter, #77)
  if (event.httpMethod === 'POST') {
    const clientIP = getClientIP(event);
    const allowed = await checkRateLimit(clientIP, 'fatiha', HOT_ENDPOINT_RATE_LIMITS.fatiha);
    if (!allowed) {
      return error(429, 'تم تجاوز الحد المسموح، يرجى المحاولة لاحقًا.', origin);
    }
    await recordRequest(clientIP, 'fatiha');
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (event.httpMethod === 'GET') {
      const count = await getCurrentCount(supabase);
      return success({ count }, origin);
    }

    const currentCount = await getCurrentCount(supabase);

    const { data, error: updateError } = await supabase
      .from(FATIHA_TABLE)
      .update({ count: currentCount + 1 })
      .eq('id', FATIHA_ROW_ID)
      .select('count')
      .single();

    if (updateError) throw updateError;

    return success({ count: Number(data?.count) || currentCount + 1 }, origin);
  } catch (err) {
    logger.error('[fatiha-counter] Error:', err.message);
    return error(500, 'Failed to process fatiha counter request', origin, err.message);
  }
}
