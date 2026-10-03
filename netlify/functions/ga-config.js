import { success, error, handleOptions } from './utils/shared.js';
import { config } from './utils/config.js';

export async function handler(event, context) {
    const headers = event.headers || {};
    const origin = headers.origin || headers.Origin || '';

    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(origin);
    }

    if (event.httpMethod !== 'GET') {
        return error(405, 'Method not allowed', origin);
    }

    const measurementId = config.gaMeasurementId;

    return success(
        { measurement_id: measurementId },
        origin,
        { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    );
}
