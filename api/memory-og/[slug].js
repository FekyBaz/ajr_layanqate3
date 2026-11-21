import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_PATTERN = /twitterbot|facebookexternalhit|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|sogou|exabot|facebot|ia_archiver/i;
const SLUG_PATTERN = /^[A-Za-z0-9\u0600-\u06FF_-]{3,100}$/;
let templateCache;

function getTemplate() {
    if (templateCache === undefined) {
        templateCache = readFileSync(join(process.cwd(), 'memory.html'), 'utf8');
    }
    return templateCache;
}

function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildDescription(memory) {
    const bio = String(memory.biography || '').trim().replace(/\s+/g, ' ');
    const shortBio = bio.length > 140 ? bio.slice(0, 140) + '…' : bio;
    const base = 'صدقة جارية على روح ' + (memory.deceased_name || 'متوفى');
    return shortBio ? base + ' — ' + shortBio : base + ' — أجر لا ينقطع';
}

async function fetchApprovedMemory(slug) {
    const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
    if (!supabaseUrl || !anonKey) return null;

    const query = new URLSearchParams({
        slug: `eq.${slug}`,
        status: 'eq.Approved',
        select: 'deceased_name,biography,slug',
        limit: '1',
    });
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/memories?${query}`, {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) return null;
        const rows = await response.json();
        return Array.isArray(rows) && rows.length ? rows[0] : null;
    } catch {
        return null;
    }
}

function injectHead(html, pageUrl, title, description) {
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeUrl = escapeHtml(pageUrl);
    let out = html;
    out = out.replace(/<title>[^<]*<\/title>/, '<title>' + safeTitle + '</title>');

    const tags = '<meta property="og:title" content="' + safeTitle + '">' +
        '\n    <meta property="og:description" content="' + safeDescription + '">' +
        '\n    <meta property="og:url" content="' + safeUrl + '">' +
        '\n    <meta name="twitter:title" content="' + safeTitle + '">' +
        '\n    <meta name="twitter:description" content="' + safeDescription + '">';

    out = out.replace(
        /<meta property="og:title"[^>]*>\s*<meta property="og:description"[^>]*>\s*<meta property="og:url"[^>]*>\s*<meta name="twitter:title"[^>]*>\s*<meta name="twitter:description"[^>]*>/,
        tags,
    );
    out = out.replace(
        /<meta name="description" content="[^"]*">/,
        '<meta name="description" content="' + safeDescription + '">',
    );
    out = out.replace(
        /<link rel="canonical" href="[^"]*">/,
        '<link rel="canonical" href="' + safeUrl + '">',
    );
    return out;
}

export default async function memoryOg(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        res.statusCode = 405;
        res.end('');
        return;
    }

    try {
        const html = getTemplate();
        const host = String(req.headers.host || 'localhost:3000');
        const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
        const requestOrigin = `${proto}://${host}`;
        const rawSlug = Array.isArray(req.query?.slug) ? req.query.slug[0] : req.query?.slug;
        const slug = String(rawSlug || '').trim();
        const userAgent = String(req.headers['user-agent'] || '');

        if (!BOT_PATTERN.test(userAgent) || !SLUG_PATTERN.test(slug)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            res.statusCode = 200;
            res.end(method === 'HEAD' ? '' : html);
            return;
        }

        const memory = await fetchApprovedMemory(slug);
        if (!memory) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            res.statusCode = 200;
            res.end(html);
            return;
        }

        const pageUrl = new URL('/memory/' + encodeURIComponent(slug), requestOrigin).href;
        const title = (memory.deceased_name || 'صدقة جارية') + ' | أجر لا ينقطع';
        const rendered = injectHead(html, pageUrl, title, buildDescription(memory));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
        res.statusCode = 200;
        res.end(method === 'HEAD' ? '' : rendered);
    } catch (err) {
        console.error('[memory-og] Failed to render memory preview:', err?.message || err);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = 200;
        res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>أجر لا ينقطع</title><body>أجر لا ينقطع</body></html>');
    }
}
