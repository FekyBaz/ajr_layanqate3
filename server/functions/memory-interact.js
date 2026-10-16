/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/memory-interact
 * Record an interaction (tasbeeh, dua, share) on a memorial page
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabaseAdmin,
    success,
    error,
    handleOptions,
    hashIP,
    isUuid,
    getClientIP,
    logger,
} from './utils/shared.js';
import { config } from './utils/config.js';

const VALID_INTERACTION_TYPES = ['tasbeeh', 'dua', 'share'];

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return error(405, 'Method not allowed', origin);
    }

    try {
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const { memory_id, interaction_type } = body;

        // Validate memory_id (strict UUID — the RPC column rejects anything else)
        if (!isUuid(memory_id)) {
            return error(400, 'معرف الصفحة مطلوب', origin);
        }

        // Validate interaction_type
        if (!interaction_type || !VALID_INTERACTION_TYPES.includes(interaction_type)) {
            return error(400, 'نوع التفاعل غير صالح', origin);
        }

        // Hash client IP (single salted hashIP shared by all writers)
        const clientIP = getClientIP(event);
        const ipHash = hashIP(clientIP);

        // Call atomic RPC
        const { data: result, error: rpcError } = await supabaseAdmin.rpc('record_memory_interaction', {
            p_memory_id: memory_id,
            p_interaction_type: interaction_type,
            p_ip_hash: ipHash,
            p_debounce_seconds: config.memoryInteractionDebounceSeconds,
        });

        if (rpcError) {
            logger.error('record_memory_interaction RPC error:', rpcError.message);
            return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
        }

        if (!result.recorded) {
            if (result.reason === 'not_found') {
                return error(404, 'الصفحة غير موجودة', origin);
            }
            if (result.reason === 'not_approved') {
                return error(404, 'الصفحة غير موجودة', origin);
            }
            if (result.reason === 'debounced') {
                // Silent success — don't reveal debounce to client
                return success({ recorded: true }, origin);
            }
            return error(400, 'لم يتم تسجيل التفاعل', origin);
        }

        return success({
            recorded: true,
            total_interactions: result.total_interactions,
        }, origin);

    } catch (err) {
        logger.error('memory-interact unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
