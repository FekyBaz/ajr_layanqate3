/**
 * Vercel deployment configuration-readiness endpoint.
 *
 * This route intentionally does not import the shared Supabase utilities:
 * missing credentials must produce a useful 503 response, not a module-load
 * crash that makes every API path untestable.
 *
 * A successful response confirms required variables are present and shaped
 * correctly; it does not claim Supabase connectivity or data-path health.
 */

const REQUIRED_ENVIRONMENT_LABELS = Object.freeze([
    ['SUPABASE_URL', 'Supabase URL'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key'],
    ['SUPABASE_ANON_KEY', 'Supabase anonymous key'],
    ['IP_SALT', 'IP hashing salt'],
    ['CRON_SECRET', 'Cron secret'],
]);

export function getMissingRuntimeConfig(env = process.env) {
    const missing = REQUIRED_ENVIRONMENT_LABELS
        .filter(([key]) => !String(env[key] || '').trim())
        .map(([, label]) => label);

    const supabaseUrl = String(env.SUPABASE_URL || '').trim();
    if (supabaseUrl) {
        try {
            const parsed = new URL(supabaseUrl);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                missing.push('Valid Supabase URL');
            }
        } catch {
            missing.push('Valid Supabase URL');
        }
    }

    if (!String(env.ADMIN_API_KEY || env.ADMIN_KEY || '').trim()) {
        missing.push('Admin API key');
    }

    if (String(env.CRON_SECRET || '').trim().length < 16) {
        missing.push('Cron secret length');
    }

    return missing;
}

export default function healthHandler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.statusCode = 405;
        res.end(JSON.stringify({
            success: false,
            message: 'Method not allowed',
            error_code: 'METHOD_NOT_ALLOWED',
        }));
        return;
    }

    const missing = getMissingRuntimeConfig();
    const ready = missing.length === 0;
    const body = ready
        ? {
            success: true,
            status: 'configured',
            service: 'أجر لا ينقطع API',
            runtime: 'vercel',
            note: 'This check validates required environment configuration only; it does not test Supabase connectivity.',
        }
        : {
            success: false,
            status: 'not_ready',
            message: 'Required server configuration is incomplete.',
            error_code: 'CONFIGURATION_INCOMPLETE',
        };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.statusCode = ready ? 200 : 503;
    res.end(method === 'HEAD' ? '' : JSON.stringify(body));
}
