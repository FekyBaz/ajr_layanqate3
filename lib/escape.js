/**
 * Shared HTML escaping + URL validation helpers (see issue #70).
 *
 * Why a shared module: `escapeHtml()` was copy-pasted in 6+ files and applied
 * inconsistently — text-context escaping does NOT protect `value="..."`,
 * `aria-label="..."`, `href` or `src` attribute contexts, which allowed
 * attribute-breakout payloads such as `" onmouseover="...`.
 *
 * - `escapeHtml()` — text nodes and element content.
 * - `escapeAttr()` — quoted attribute values (also escapes `"`).
 * - `isSafeHttpUrl()` — allow-list for `src`/`href` values.
 *
 * Usable as classic script (`window.EscapeLib`), ES module, or CommonJS.
 */
(function (global) {
    'use strict';

    /**
     * Escape a value for use as element text content.
     * @param {*} value
     * @returns {string}
     */
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Escape a value for use inside a double-quoted HTML attribute.
     * @param {*} value
     * @returns {string}
     */
    function escapeAttr(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;');
    }

    /**
     * Check a URL value against an allow-list before injecting it into
     * `src`/`href`. Allows http(s), relative paths, and (by default)
     * `data:image/*` (canvas exports). Blocks `javascript:`, `data:text/html`,
     * `vbscript:` and other schemes.
     * @param {*} value
     * @param {Object} [options]
     * @param {boolean} [options.allowRelative=true]
     * @param {boolean} [options.allowDataImage=true]
     * @returns {boolean}
     */
    function isSafeHttpUrl(value, options) {
        const opts = options || {};
        const allowRelative = opts.allowRelative !== false;
        const allowDataImage = opts.allowDataImage !== false;
        if (typeof value !== 'string') return false;
        const trimmed = value.trim();
        if (trimmed === '') return false;
        if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
        const schemeMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(trimmed);
        if (!schemeMatch) return allowRelative;
        const scheme = schemeMatch[0].toLowerCase();
        if (scheme === 'http:' || scheme === 'https:') return true;
        if (scheme === 'data:') {
            return allowDataImage && /^data:image\//i.test(trimmed);
        }
        return false;
    }

    const api = { escapeHtml, escapeAttr, isSafeHttpUrl };

    global.EscapeLib = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(globalThis);
