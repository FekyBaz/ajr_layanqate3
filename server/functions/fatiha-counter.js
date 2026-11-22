import { supabaseAdmin, success, error, handleOptions, logger, getClientIP, checkRateLimit, recordRequest, HOT_ENDPOINT_RATE_LIMITS } from './utils/shared.js';

const FATIHA_ROW_ID = 1;
const FATIHA_TABLE = 'fatiha_counter';

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
    if (event.httpMethod === 'GET') {
      const count = await getCurrentCount(supabaseAdmin);
      return success({ count }, origin);
    }

    // Single atomic increment (migration 026) — no read-modify-write race (#110)
    const { data: newCount, error: rpcError } = await supabaseAdmin
      .rpc('increment_fatiha_counter');

    if (rpcError) throw rpcError;

    return success({ count: Number(newCount) || 0 }, origin);
  } catch (err) {
    logger.error('[fatiha-counter] Error:', err.message);
    return error(500, 'Failed to process fatiha counter request', origin, err.message);
  }
}
