import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from './utils/shared.js';

const FATIHA_ROW_ID = 1;
const FATIHA_TABLE = 'fatiha_counter';

function jsonResponse(statusCode, origin, payload) {
  return {
    statusCode,
    headers: getCorsHeaders(origin),
    body: JSON.stringify(payload)
  };
}

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
    return {
      statusCode: 204,
      headers: getCorsHeaders(origin),
      body: ''
    };
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return jsonResponse(405, origin, { message: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (event.httpMethod === 'GET') {
      const count = await getCurrentCount(supabase);
      return jsonResponse(200, origin, { count });
    }

    const currentCount = await getCurrentCount(supabase);

    const { data, error } = await supabase
      .from(FATIHA_TABLE)
      .update({ count: currentCount + 1 })
      .eq('id', FATIHA_ROW_ID)
      .select('count')
      .single();

    if (error) throw error;

    return jsonResponse(200, origin, { count: Number(data?.count) || currentCount + 1 });
  } catch (error) {
    console.error('[fatiha-counter] Error:', error.message);
    return jsonResponse(500, origin, { message: 'Failed to process fatiha counter request' });
  }
}
