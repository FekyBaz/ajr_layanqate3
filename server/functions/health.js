/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GET /.netlify/functions/health
 * Health check endpoint
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { success, handleOptions } from './utils/shared.js';

export async function handler(event, context) {
    const origin = event.headers.origin || '';

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    return success({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'أجر لا ينقطع API',
    }, origin);
}
