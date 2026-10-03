/**
 * Single source for frontend API configuration (see issue #74).
 *
 * Replaces the copy-pasted `PRODUCTION_API_URL / isProduction / API_BASE`
 * boilerplate in script.js, memory.js, memories.js, contact.js,
 * create-memory.js, home-memories-preview.js and admin.js.
 *
 * Semantics preserved exactly:
 * - Local hostnames (localhost / 127.0.0.1) → http://localhost:8888
 * - Otherwise → PRODUCTION_API_URL (empty = same-origin relative calls)
 *
 * Load with `<script src="lib/config.js">` BEFORE any script using
 * `window.AppConfig`. Usable as classic script, ES module global, or CJS.
 */
(function (global) {
    'use strict';

    // Change this to the production backend URL when the API lives
    // on a different origin. Leave empty for same-origin deployments
    // (e.g. Netlify Functions under /.netlify/functions).
    var PRODUCTION_API_URL = '';

    var hostname = (global.location && global.location.hostname) || '';
    var isProduction = hostname.indexOf('localhost') === -1 &&
        hostname.indexOf('127.0.0.1') === -1;

    var API_BASE = isProduction ? PRODUCTION_API_URL : 'http://localhost:8888';

    function apiUrl(path) {
        return API_BASE + path;
    }

    var api = {
        PRODUCTION_API_URL: PRODUCTION_API_URL,
        isProduction: isProduction,
        API_BASE: API_BASE,
        apiUrl: apiUrl,
    };

    global.AppConfig = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(globalThis);
