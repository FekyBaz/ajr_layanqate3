/**
 * Service worker registration (external file to comply with the
 * script-src 'self' CSP — no inline handlers, see issue #69).
 */
(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    function register() {
        navigator.serviceWorker.register('/sw.js').catch(function () {
            // Offline support is best-effort; the site works without it.
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        register();
    } else {
        document.addEventListener('DOMContentLoaded', register, { once: true });
    }
})();
