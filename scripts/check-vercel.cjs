/**
 * Vercel configuration guard.
 *
 * Validates the deployment contract that CI cannot otherwise observe:
 * static output wiring, Hobby-plan limits, security headers, clean-URL
 * rewrites, and crawler-only routing. Run via `npm run guard:vercel`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));
const failures = [];
const fail = (message) => failures.push(message);

let config;
try {
    config = JSON.parse(read('vercel.json'));
} catch (error) {
    console.error(`vercel.json is not valid JSON: ${error.message}`);
    process.exit(1);
}

const buildSource = read('scripts/build-public.cjs');
const allowlistBlock = buildSource.match(/const PUBLIC_FILES = \[([\s\S]*?)\];/);
if (!allowlistBlock) fail('Could not read PUBLIC_FILES from scripts/build-public.cjs');
const publicFiles = new Set(
    Array.from((allowlistBlock?.[1] || '').matchAll(/'([^']+)'/g)).map((match) => match[1]),
);

if (config.framework !== null) fail('framework must be null so Vercel does not auto-detect a framework');
if (config.buildCommand !== 'npm run build') fail('buildCommand must run the public allowlist build');
if (config.outputDirectory !== 'dist') fail('outputDirectory must be the generated dist directory');
if (!/^npm ci\b/.test(String(config.installCommand || ''))) fail('installCommand must use the lockfile (npm ci)');

const netlifyConfig = read('netlify.toml');
const publish = netlifyConfig.match(/publish\s*=\s*"([^"]+)"/)?.[1];
if (publish !== config.outputDirectory) {
    fail(`Netlify publish (${publish}) and Vercel outputDirectory (${config.outputDirectory}) must match`);
}

const functionEntries = Object.keys(config.functions || {});
if (functionEntries.length === 0) fail('No Vercel functions configured');
if (functionEntries.length > 12) {
    fail(`Vercel Hobby allows 12 functions per deployment; found ${functionEntries.length}`);
}
for (const entry of functionEntries) {
    if (entry.includes('*')) {
        const directory = entry.slice(0, entry.lastIndexOf('/'));
        if (!exists(directory) || !fs.readdirSync(path.join(ROOT, directory)).some((name) => name.endsWith('.js'))) {
            fail(`Configured function glob ${entry} matches no JavaScript entry`);
        }
    } else if (!exists(entry)) {
        fail(`Configured function ${entry} does not exist`);
    }
    const includeFiles = config.functions[entry].includeFiles;
    if (includeFiles && !exists(includeFiles)) {
        fail(`Function ${entry} includes missing file ${includeFiles}`);
    }
}

const crons = config.crons || [];
if (crons.length > 2) fail(`Vercel Hobby allows 2 cron jobs; found ${crons.length}`);
const routerSource = read('server/vercel-router.js');
for (const cron of crons) {
    if (!routerSource.includes(`path: '${cron.path}'`)) {
        fail(`Cron ${cron.path} is not routed by server/vercel-router.js`);
    }
    if (!cron.schedule) fail(`Cron ${cron.path} has no schedule`);
}

const rewrites = config.rewrites || [];
if (rewrites.length === 0) fail('No rewrites configured');

const rewriteKeys = new Set();
for (const rule of rewrites) {
    const key = `${rule.source}::${JSON.stringify(rule.has || null)}`;
    if (rewriteKeys.has(key)) fail(`Duplicate rewrite for ${rule.source}`);
    rewriteKeys.add(key);

    const destination = String(rule.destination || '');
    if (!destination.startsWith('/') || destination.startsWith('//')) {
        fail(`Rewrite destination ${destination} must be a same-origin path`);
    }
    if (/^\/(?:api\/migrations|server|netlify|tests|scripts|docs|prototypes|node_modules)(?:\/|$)/.test(destination)) {
        fail(`Rewrite ${rule.source} exposes internal path ${destination}`);
    }
    if (destination.endsWith('.html')) {
        const file = destination.slice(1);
        if (!publicFiles.has(file)) {
            fail(`Rewrite ${rule.source} targets ${file}, which is not in the public allowlist`);
        }
    }
}

const botRule = rewrites.find((rule) => rule.source === '/memory/:slug' &&
    rule.destination === '/api/memory-og/:slug');
if (!botRule) {
    fail('Missing crawler-only /memory/:slug rewrite to /api/memory-og/:slug');
} else {
    const userAgent = (botRule.has || []).find((condition) =>
        condition.type === 'header' && String(condition.key).toLowerCase() === 'user-agent');
    if (!userAgent || !userAgent.value) {
        fail('The crawler /memory/:slug rewrite must be gated on the user-agent header');
    }
}
const humanRule = rewrites.find((rule) => rule.source === '/memory/:slug' && !rule.has);
if (!humanRule || humanRule.destination !== '/memory.html') {
    fail('Human /memory/:slug requests must fall back to /memory.html');
}

const globalHeaders = (config.headers || []).find((rule) => rule.source === '/(.*)')?.headers || [];
const headerValue = (key) => globalHeaders.find(
    (header) => String(header.key).toLowerCase() === key.toLowerCase(),
)?.value || '';
const csp = headerValue('Content-Security-Policy');
if (!csp) fail('Missing Content-Security-Policy header');
if (/unsafe-eval/.test(csp)) fail('Content-Security-Policy must not allow unsafe-eval');
if (!/frame-ancestors 'none'/.test(csp)) fail('Content-Security-Policy must set frame-ancestors none');
if (!/connect-src[^;]*https:\/\/\*\.supabase\.co/.test(csp)) {
    fail('Content-Security-Policy connect-src must allow the Supabase project origin');
}
if (!/max-age=\d{6,}/.test(headerValue('Strict-Transport-Security'))) {
    fail('Missing or too-short Strict-Transport-Security header');
}
if (headerValue('X-Content-Type-Options') !== 'nosniff') fail('Missing nosniff header');
if (!headerValue('X-Frame-Options')) fail('Missing X-Frame-Options header');

for (const file of publicFiles) {
    if (/^(?:api|server|netlify|tests|scripts|docs|prototypes|node_modules)\//.test(file)) {
        fail(`Public allowlist must not publish internal path ${file}`);
    }
}

if (failures.length) {
    console.error('Vercel configuration guard failed:');
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
}

console.log(`Vercel configuration guard passed (${functionEntries.length} functions, ${crons.length} cron jobs, ${rewrites.length} rewrites).`);
