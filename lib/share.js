/**
 * Shared Web Share / clipboard helpers (see issue #74).
 *
 * Small building blocks for the copy-pasted `navigator.share` +
 * `navigator.clipboard.writeText` fallbacks across the site.
 * Page-specific toast UIs stay in their own files; only the
 * share-or-copy decision + clipboard fallback live here.
 *
 * Load with `<script src="lib/share.js">` before use.
 * Usable as classic script (`window.ShareLib`) or CJS.
 */
(function (global) {
    'use strict';

    /**
     * Copy text to the clipboard, with legacy textarea fallback.
     * @param {string} text
     * @returns {Promise<boolean>} true when copied
     */
    async function copyText(text) {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (_err) {
            // fall through to legacy path
        }
        try {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
            document.body.appendChild(area);
            area.select();
            const done = document.execCommand('copy');
            document.body.removeChild(area);
            return !!done;
        } catch (_err2) {
            return false;
        }
    }

    /**
     * Share via Web Share API when available, otherwise copy to clipboard.
     * Never throws; returns how the content was delivered.
     * @param {Object} data { text, url, title }
     * @returns {Promise<'shared'|'copied'|'dismissed'|'unavailable'>}
     */
    async function shareOrCopy(data) {
        const payload = data || {};
        try {
            if (typeof navigator.share === 'function') {
                await navigator.share(payload);
                return 'shared';
            }
        } catch (err) {
            if (err && err.name === 'AbortError') return 'dismissed';
        }
        const text = [payload.text, payload.url].filter(Boolean).join('\n');
        const copied = await copyText(text || '');
        return copied ? 'copied' : 'unavailable';
    }

    const api = { copyText: copyText, shareOrCopy: shareOrCopy };

    global.ShareLib = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(globalThis);
