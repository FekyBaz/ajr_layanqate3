/**
 * Netlify's thin runtime adapter.
 *
 * Business handlers live in /server/functions and consume a normalized
 * function event. Keep Netlify-specific request metadata here, not in shared
 * business logic, so the same handlers can run behind other runtimes.
 */

function normalizeHeaders(input = {}) {
    const headers = {};
    for (const [key, value] of Object.entries(input || {})) {
        if (value === undefined || value === null) continue;
        headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    return headers;
}

/**
 * Adapt Netlify's native event to the shared handler contract.
 *
 * x-nf-client-connection-ip is provided by Netlify's edge. The forwarded
 * headers are fallback values for local development and non-Netlify tests;
 * production deployments should use the platform-provided client IP.
 */
export function withNetlifyRuntime(handler) {
    if (typeof handler !== 'function') {
        throw new TypeError('withNetlifyRuntime requires a handler function');
    }

    return async function netlifyEntrypoint(event = {}, context = {}) {
        const headers = normalizeHeaders(event.headers);
        const clientIP = headers['x-nf-client-connection-ip']?.trim() ||
            headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            headers['x-real-ip']?.trim() ||
            'unknown';

        return handler({
            ...event,
            headers,
            clientIP,
        }, context);
    };
}
