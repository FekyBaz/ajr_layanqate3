import { success, error, handleOptions } from './utils/shared.js';

export async function handler(event, context) {
    const headers = event.headers || {};
    const origin = headers.origin || headers.Origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    const measurementId = process.env.GA_MEASUREMENT_ID || '';

    return success(
        { measurement_id: measurementId },
        origin,
        { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    );
}
