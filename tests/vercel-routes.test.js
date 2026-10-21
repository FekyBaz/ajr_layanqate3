import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walkFiles(directory, predicate, excludedDirectories = new Set()) {
    const results = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (!excludedDirectories.has(entry.name)) {
                results.push(...walkFiles(absolutePath, predicate, excludedDirectories));
            }
        } else if (entry.isFile() && predicate(absolutePath)) {
            results.push(absolutePath);
        }
    }
    return results;
}

test('browser-facing files do not call Netlify Functions directly', () => {
    const browserFiles = walkFiles(ROOT, (file) => /\.(?:js|html)$/i.test(file), new Set([
        '.git', '.vercel', 'node_modules', '.github', 'api', 'netlify', 'server', 'tests',
    ]));
    const forbidden = /\/\.netlify\/functions(?:\/|$)/;
    const matches = [];

    for (const file of browserFiles) {
        if (forbidden.test(readFileSync(file, 'utf8'))) matches.push(relative(ROOT, file));
    }
    assert.deepEqual(matches, [], 'Browser files should use same-origin /api routes');
});

test('Vercel API handlers are dispatched through one catch-all function', () => {
    const apiRoot = join(ROOT, 'api');
    const apiFunctions = walkFiles(apiRoot, (file) => file.endsWith('.js'))
        .map((file) => relative(apiRoot, file).replaceAll('\\', '/'))
        .sort();

    assert.deepEqual(apiFunctions, ['[...path].js', 'health.js', 'memory-og/[slug].js'],
        'Hobby deployment should expose only the dispatcher and memory OG function');
    assert.ok(apiFunctions.length <= 12, 'Function count must fit Vercel Hobby limit');

    const dispatcher = readFileSync(join(ROOT, 'server', 'vercel-router.js'), 'utf8');
    const imports = new Map();
    for (const match of dispatcher.matchAll(/import\s+\{\s*handler\s+as\s+(\w+)\s*\}\s+from\s+['"]\.\/functions\/([^'"]+)['"]/g)) {
        imports.set(match[1], match[2].replace(/\.js$/, ''));
    }

    const definitions = Array.from(dispatcher.matchAll(
        /\{\s*path:\s*['"]([^'"]+)['"],\s*handler:\s*(\w+)(?:,\s*scheduled:\s*true)?\s*\}/g,
    )).map((match) => ({ path: match[1], handler: match[2], scheduled: /scheduled:\s*true/.test(match[0]) }));

    assert.equal(definitions.length, 35, 'All 35 routed API endpoints should be preserved; health is isolated');
    assert.equal(new Set(definitions.map((route) => route.path)).size, definitions.length,
        'API paths must be unique');
    assert.ok(definitions.every((route) => route.path.startsWith('/api/')));

    for (const route of definitions) {
        assert.ok(imports.has(route.handler), route.path + ' imports a known handler');
    }

    const mappedModules = new Set(definitions.map((route) => imports.get(route.handler)));
    const sourceHandlers = readdirSync(join(ROOT, 'server', 'functions'), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
        .map((entry) => entry.name.replace(/\.js$/, ''))
        .sort();
    assert.deepEqual([...mappedModules].sort(), sourceHandlers.filter((name) => name !== 'health'),
        'Every server handler must be reachable through the dispatcher');

    const scheduled = definitions.filter((route) => route.scheduled).map((route) => route.path).sort();
    assert.deepEqual(scheduled, [
        '/api/cron/cleanup-automation',
        '/api/cron/daily-feature-refresh',
    ]);
    assert.ok(existsSync(join(apiRoot, 'memory-og', '[slug].js')),
        'Crawler-specific memory metadata route must remain present');
});

test('Vercel routing and Cron config is valid JSON for the catch-all dispatcher', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    const cronPaths = new Set((config.crons || []).map((cron) => cron.path));
    assert.ok(cronPaths.has('/api/cron/daily-feature-refresh'));
    assert.ok(cronPaths.has('/api/cron/cleanup-automation'));
    assert.ok(Array.isArray(config.rewrites));
    assert.ok(config.rewrites.some((rule) => rule.source === '/memory/:slug'));
    assert.equal(config.functions['api/[...path].js']?.maxDuration, 30);
    assert.equal(config.functions['api/memory-og/*.js']?.maxDuration, 10);
});

test('Node.js runtime policy remains aligned on Node.js 24', () => {
    const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const nvmrc = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim();
    assert.equal(nvmrc, '24');
    assert.equal(packageJson.engines?.node, '24.x');
});

test('isolated health endpoint fails closed when runtime configuration is missing', async () => {
    const { getMissingRuntimeConfig } = await import('../api/health.js');
    assert.ok(getMissingRuntimeConfig({}).length >= 6);

    const validTestConfig = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
        SUPABASE_ANON_KEY: 'test-anon-key',
        ADMIN_API_KEY: 'test-admin-key',
        IP_SALT: 'a'.repeat(32),
        CRON_SECRET: 'b'.repeat(32),
    };
    assert.deepEqual(getMissingRuntimeConfig(validTestConfig), []);
    assert.ok(getMissingRuntimeConfig({
        ...validTestConfig,
        SUPABASE_URL: 'not a URL',
    }).includes('Valid Supabase URL'));
});
