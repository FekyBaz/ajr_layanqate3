/**
 * Per-memory OG prerender for crawlers (see issue #111).
 *
 * Netlify Edge Function on /memory/*. Human traffic passes straight through
 * (context.next) — only bot user-agents get a server-rendered <head> with
 * the deceased name, because crawlers never execute the client-side title
 * update in memory.js.
 *
 * No cloaking: bots receive the same public data (approved memories only,
 * via the anon key + RLS), with only head tags differing.
 *
 * Plain JS (no netlify: imports) so `node --check` stays green.
 */

var BOT_PATTERN = /twitterbot|facebookexternalhit|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|sogou|exabot|facebot|ia_archiver/i;
var SLUG_PATTERN = /^[A-Za-z0-9\u0600-\u06FF_-]{3,100}$/;

function getEnv(name) {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env) return Netlify.env.get(name) || '';
  } catch (_err) {
    // ignore — fall through to missing
  }
  return '';
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDescription(memory) {
  var bio = (memory.biography || '').trim().replace(/\s+/g, ' ');
  if (bio.length > 140) bio = bio.slice(0, 140) + '…';
  var base = 'صدقة جارية على روح ' + (memory.deceased_name || 'متوفى');
  return bio ? base + ' — ' + bio : base + ' — أجر لا ينقطع';
}

async function fetchApprovedMemory(supabaseUrl, anonKey, slug) {
  var endpoint = supabaseUrl.replace(/\/+$/, '') +
    '/rest/v1/memories?slug=eq.' + encodeURIComponent(slug) +
    '&status=eq.Approved&select=deceased_name,biography,slug&limit=1';
  var res = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  var rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function injectHead(html, pageUrl, title, description) {
  var safeTitle = escapeHtml(title);
  var safeDesc = escapeHtml(description);
  var out = html;
  out = out.replace(
    /<title>[^<]*<\/title>/,
    '<title>' + safeTitle + '</title>',
  );
  var tags =
    '<meta property="og:title" content="' + safeTitle + '">\n' +
    '    <meta property="og:description" content="' + safeDesc + '">\n' +
    '    <meta property="og:url" content="' + pageUrl + '">\n' +
    '    <meta name="twitter:title" content="' + safeTitle + '">\n' +
    '    <meta name="twitter:description" content="' + safeDesc + '">';
  // Replace the generic per-memory block (og:title → twitter:description)
  // instead of duplicating tags.
  out = out.replace(
    /<meta property="og:title"[^>]*>\s*<meta property="og:description"[^>]*>\s*<meta property="og:url"[^>]*>\s*<meta name="twitter:title"[^>]*>\s*<meta name="twitter:description"[^>]*>/,
    tags,
  );
  out = out.replace(
    /<meta name="description" content="[^"]*">/,
    '<meta name="description" content="' + safeDesc + '">',
  );
  out = out.replace(
    /<link rel="canonical" href="[^"]*">/,
    '<link rel="canonical" href="' + pageUrl + '">',
  );
  return out;
}

export default async function handler(request, context) {
  var userAgent = '';
  try {
    userAgent = request.headers.get('user-agent') || '';
  } catch (_err) {
    return context.next();
  }
  if (!BOT_PATTERN.test(userAgent)) return context.next();

  var url;
  try {
    url = new URL(request.url);
  } catch (_err2) {
    return context.next();
  }
  var slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  if (!SLUG_PATTERN.test(slug)) return context.next();

  var supabaseUrl = getEnv('SUPABASE_URL');
  var anonKey = getEnv('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return context.next();

  try {
    var memory = await fetchApprovedMemory(supabaseUrl, anonKey, slug);
    if (!memory) return context.next();

    var templateRes = await fetch(new URL('/memory.html', url.origin + '/').href);
    if (!templateRes.ok) return context.next();
    var html = await templateRes.text();

    var pageUrl = url.origin + '/memory/' + encodeURIComponent(slug);
    var title = (memory.deceased_name || 'صدقة جارية') + ' | أجر لا ينقطع';
    var rendered = injectHead(html, pageUrl, title, buildDescription(memory));
    return new Response(rendered, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch (_err3) {
    return context.next();
  }
}
