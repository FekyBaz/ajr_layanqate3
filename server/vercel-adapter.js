import crypto from 'node:crypto';

function normalizeHeaders(input = {}) {
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined || value === null) continue;
        output[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    return output;
}

function normalizeBody(body) {
    if (body === undefined || body === null) return '';
    if (typeof body === 'string') return body;
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    return JSON.stringify(body);
}

function makeEvent(req, includeMethod = true) {
    const headers = normalizeHeaders(req.headers);
    const protocol = (headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = headers.host || 'localhost';
    const url = new URL(req.url || '/', `${protocol}://${host}`);
    const queryStringParameters = {};
    for (const [key, value] of url.searchParams.entries()) {
        queryStringParameters[key] = value;
    }

    const event = {
        headers,
        body: normalizeBody(req.body),
        path: url.pathname,
        rawUrl: url.href,
        queryStringParameters,
        isBase64Encoded: false,
    };
    if (includeMethod) event.httpMethod = String(req.method || 'GET').toUpperCase();
    return event;
}

function sendResult(res, result) {
    const response = result && typeof result === 'object' ? result : {};
    for (const [name, value] of Object.entries(response.headers || {})) {
        if (value !== undefined && value !== null) res.setHeader(name, value);
    }
    res.statusCode = Number.isInteger(response.statusCode) ? response.statusCode : 200;
    res.end(response.body === undefined || response.body === null ? '' : response.body);
}

function sendError(res, err) {
    console.error('[vercel-adapter] Handler failed:', err?.message || err);
    if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
    }
    res.statusCode = 500;
    res.end(JSON.stringify({
        success: false,
        message: 'Internal server error',
        error_code: 'SERVER_ERROR',
    }));
}

export function netlifyHandlerToVercel(handler) {
    return async function vercelApiHandler(req, res) {
        try {
            const event = makeEvent(req, true);
            const result = await handler(event, {});
            sendResult(res, result);
        } catch (err) {
            sendError(res, err);
        }
    };
}

function hasValidCronSecret(req) {
    const expectedSecret = process.env.CRON_SECRET || '';
    const headers = normalizeHeaders(req.headers);
    const supplied = headers.authorization || '';
    if (!expectedSecret || !supplied.startsWith('Bearer ')) return false;

    const expected = Buffer.from(`Bearer ${expectedSecret}`);
    const actual = Buffer.from(supplied);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function scheduledHandlerToVercel(handler) {
    return async function vercelCronHandler(req, res) {
        if (String(req.method || 'GET').toUpperCase() !== 'GET') {
            res.setHeader('Allow', 'GET');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 405;
            res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
            return;
        }
        if (!hasValidCronSecret(req)) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.statusCode = process.env.CRON_SECRET ? 401 : 503;
            res.end(JSON.stringify({
                success: false,
                message: process.env.CRON_SECRET ? 'Unauthorized' : 'Cron authentication is not configured',
            }));
            return;
        }

        try {
            // The secret was validated above; omitting httpMethod marks this
            // as an authenticated scheduled invocation to the shared handler.
            const event = makeEvent(req, false);
            const result = await handler(event, {});
            sendResult(res, result);
        } catch (err) {
            sendError(res, err);
        }
    };
}
