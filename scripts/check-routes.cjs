/**
 * API routing guard.
 *
 * Fails when a serverless handler is unreachable, when a provider wrapper has
 * no canonical implementation, or when the Vercel cron list and the Netlify
 * redirect table drift apart. Run via `npm run guard:routes`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));
const failures = [];
const fail = (message) => failures.push(message);

const routerSource = read('server/vercel-router.js');
const vercelConfig = JSON.parse(read('vercel.json'));
const netlifyConfig = read('netlify.toml');

const routes = Array.from(routerSource.matchAll(
    /\{\s*path:\s*'([^']+)',\s*handler:\s*(\w+)([^}]*)\}/g,
)).map((match) => ({
    path: match[1],
    handler: match[2],
    scheduled: /scheduled:\s*true/.test(match[3]),
}));

if (routes.length === 0) fail('server/vercel-router.js does not define any routes');

const imports = new Map();
for (const match of routerSource.matchAll(
    /import\s+\{\s*handler\s+as\s+(\w+)\s*\}\s+from\s+'\.\/functions\/([^']+)'/g,
)) {
    imports.set(match[1], match[2]);
}

const seenPaths = new Set();
for (const route of routes) {
    if (!route.path.startsWith('/api/')) fail(`Route ${route.path} must start with /api/`);
    if (seenPaths.has(route.path)) fail(`Duplicate route path: ${route.path}`);
    seenPaths.add(route.path);

    const moduleName = imports.get(route.handler);
    if (!moduleName) {
        fail(`Route ${route.path} references unknown handler ${route.handler}`);
        continue;
    }
    if (!exists(`server/functions/${moduleName}`)) {
        fail(`Route ${route.path} points to missing server/functions/${moduleName}`);
    }
    if (!exists(`netlify/functions/${moduleName}`)) {
        fail(`Route ${route.path} has no Netlify wrapper at netlify/functions/${moduleName}`);
    }
}

const serverHandlers = fs.readdirSync(path.join(ROOT, 'server', 'functions'))
    .filter((name) => name.endsWith('.js') && name !== 'health.js')
    .sort();
const routedModules = new Set(imports.values());
for (const handler of serverHandlers) {
    if (!routedModules.has(handler)) {
        fail(`server/functions/${handler} is not reachable from server/vercel-router.js`);
    }
}

const netlifyEntries = fs.readdirSync(path.join(ROOT, 'netlify', 'functions'))
    .filter((name) => name.endsWith('.js'))
    .sort();
const wrapperModules = new Set([...routedModules, 'health.js']);
for (const entry of netlifyEntries) {
    if (!wrapperModules.has(entry)) {
        fail(`netlify/functions/${entry} is not backed by a canonical server handler`);
    }
}

const redirectSources = new Set(
    Array.from(netlifyConfig.matchAll(/from\s*=\s*"([^"]+)"/g)).map((match) => match[1]),
);
for (const route of routes.filter((item) => !item.scheduled)) {
    if (!redirectSources.has(route.path)) {
        fail(`netlify.toml has no redirect for ${route.path}; Netlify rollback would break`);
    }
}
if (!redirectSources.has('/api/health')) {
    fail('netlify.toml has no redirect for /api/health');
}

const cronRoutes = routes.filter((route) => route.scheduled).map((route) => route.path).sort();
const configuredCrons = (vercelConfig.crons || []).map((cron) => cron.path).sort();
if (JSON.stringify(cronRoutes) !== JSON.stringify(configuredCrons)) {
    fail(`vercel.json crons ${JSON.stringify(configuredCrons)} do not match scheduled routes ${JSON.stringify(cronRoutes)}`);
}

const CRON_FIELD = /^(\*|(\d+|\*)(\/\d+)?|\d+-\d+|\d+(,\d+)+)$/;
for (const cron of vercelConfig.crons || []) {
    const fields = String(cron.schedule || '').trim().split(/\s+/);
    if (fields.length !== 5 || fields.some((field) => !CRON_FIELD.test(field))) {
        fail(`Invalid cron schedule for ${cron.path}: ${cron.schedule}`);
    }
}

if (!exists('api/[...path].js')) fail('Missing Vercel catch-all entry point api/[...path].js');
if (!exists('api/health.js')) fail('Missing Vercel health entry point api/health.js');
const catchAll = read('api/[...path].js');
if (!/from\s+'\.\.\/server\/vercel-router\.js'/.test(catchAll) || !/export\s+default\s+\w+/.test(catchAll)) {
    fail('api/[...path].js must export the shared Vercel router as its default handler');
}

if (failures.length) {
    console.error('API routing guard failed:');
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
}

console.log(`API routing guard passed (${routes.length} routes, ${configuredCrons.length} cron jobs).`);
