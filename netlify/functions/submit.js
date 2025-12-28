/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST /.netlify/functions/submit
 * Submit a new dhikr/dua/ayah/hadith
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
    supabase,
    success,
    error,
    handleOptions,
    sanitizeMessage,
    sanitizeName,
    validateContentType,
    generateMessageHash,
    checkRateLimit,
    recordRequest,
    getClientIP,
} from './utils/shared.js';

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
        // Get client IP and check rate limit
        const clientIP = getClientIP(event);
        const withinLimit = await checkRateLimit(clientIP);

        if (!withinLimit) {
            return error(429, 'تم تجاوز الحد المسموح من المشاركات. يرجى المحاولة لاحقًا.', origin);
        }

        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return error(400, 'طلب غير صالح', origin);
        }

        const { message, content_type, author_name } = body;

        // Validate content_type
        if (!validateContentType(content_type)) {
            return error(400, 'يرجى اختيار نوع المحتوى', origin);
        }

        // Sanitize message
        const messageResult = sanitizeMessage(message);
        if (!messageResult.isValid) {
            return error(400, messageResult.error, origin);
        }

        // Sanitize author name
        const sanitizedName = sanitizeName(author_name);

        // Generate hash for duplicate detection
        const messageHash = generateMessageHash(messageResult.sanitized);

        // Check for duplicates
        const { data: existing } = await supabase
            .from('submissions')
            .select('id')
            .eq('message_hash', messageHash)
            .limit(1)
            .single();

        if (existing) {
            // Silent rejection - return success to prevent probing
            return success({ message: 'تم استلام مشاركتك. جزاك الله خيرًا.' }, origin);
        }

        // Build insert data - omit author_name if empty to use DB default
        const insertData = {
            message: messageResult.sanitized,
            content_type: content_type,
            message_hash: messageHash,
            // Only include author_name if sanitizedName is truthy (not null/undefined/empty)
            ...(sanitizedName && { author_name: sanitizedName }),
        };

        // Insert submission
        const { error: insertError } = await supabase
            .from('submissions')
            .insert(insertData);

        if (insertError) {
            console.error('Database insert error:', insertError.message);
            return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
        }

        // Record successful request for rate limiting
        await recordRequest(clientIP);

        return success({ message: 'تم استلام مشاركتك. جزاك الله خيرًا.' }, origin);

    } catch (err) {
        console.error('Unexpected error:', err.message);
        return error(500, 'حدث خطأ. يرجى المحاولة لاحقًا.', origin);
    }
}
