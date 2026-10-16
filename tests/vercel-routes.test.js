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
        '.git',
        '.vercel',
        'node_modules',
        '.github',
        'api',
        'netlify',
        'server',
        'tests',
    ]));
    const forbidden = /\/\.netlify\/functions(?:\/|[?'"`])/;
    const matches = [];

    for (const file of browserFiles) {
        const source = readFileSync(file, 'utf8');
        if (forbidden.test(source)) {
            matches.push(relative(ROOT, file));
        }
    }

    assert.deepEqual(matches, [], 'Browser files should use same-origin /api routes');
});

test('every Vercel API adapter imports an existing server handler', () => {
    const apiRoot = join(ROOT, 'api');
    const serverFunctionsRoot = join(ROOT, 'server', 'functions');
    const routeFiles = walkFiles(apiRoot, (file) => file.endsWith('.js'))
        .filter((file) => relative(apiRoot, file) !== join('memory-og', '[slug].js'));

    const mappedHandlers = new Set();

    for (const routeFile of routeFiles) {
        const relativeRoute = relative(apiRoot, routeFile);
        const source = readFileSync(routeFile, 'utf8');
        const handlerImport = source.match(/import\s*\{\s*handler\s*\}\s*from\s*['"]([^'"]+)['"]/);

        assert.ok(handlerImport, `${relativeRoute} must import a named handler`);
        assert.match(source, /from\s+['"][^'"]*server\/vercel-adapter\.js['"]/,
            `${relativeRoute} must use the Vercel adapter`);

        const handlerPath = resolve(dirname(routeFile), handlerImport[1]);
        assert.ok(existsSync(handlerPath), `${relativeRoute} points to missing ${handlerImport[1]}`);
        mappedHandlers.add(handlerPath);
    }

    const sourceHandlers = readdirSync(serverFunctionsRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
        .map((entry) => join(serverFunctionsRoot, entry.name));

    const missingRoutes = sourceHandlers
        .filter((handlerPath) => !mappedHandlers.has(handlerPath))
        .map((handlerPath) => relative(ROOT, handlerPath))
        .sort();

    assert.deepEqual(missingRoutes, [], 'Every server handler needs a Vercel API route');
    assert.ok(existsSync(join(apiRoot, 'memory-og', '[slug].js')),
        'Crawler-specific memory metadata route must remain present');
});

test('Vercel routing and cron config is valid JSON with both scheduled routes', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    const cronPaths = new Set((config.crons || []).map((cron) => cron.path));
    assert.ok(cronPaths.has('/api/cron/daily-feature-refresh'));
    assert.ok(cronPaths.has('/api/cron/cleanup-automation'));
    assert.ok(Array.isArray(config.rewrites));
    assert.ok(config.rewrites.some((rule) => rule.source === '/memory/:slug'));
});
