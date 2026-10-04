/**
 * Timeout-bounded fetch helpers (see issue #145).
 *
 * Nothing in the frontend used AbortController, so stalled networks hung
 * the UI forever (admin actions, dataset loads, form submissions).
 * All helpers fail fast with a timeout error; callers map it onto their
 * existing toast/error UX — no new UI strings except one Arabic message.
 *
 * Usable as classic script (`window.FetchUtils`) — no build step.
 */
(function (global) {
    'use strict';

    var DEFAULT_TIMEOUT_MS = 15000;
    var DATASET_TIMEOUT_MS = 30000;

    function timeoutError(ms) {
        var err = new Error('انتهت مهلة الاتصال. يرجى المحاولة لاحقًا.');
        err.name = 'TimeoutError';
        err.timeoutMs = ms;
        return err;
    }

    /**
     * fetch() that rejects after `ms` (default 15s).
     * @param {string} url
     * @param {Object} [options] fetch options
     * @param {number} [ms]
     */
    function fetchWithTimeout(url, options, ms) {
        var timeout = typeof ms === 'number' && ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
        var opts = options || {};
        if (typeof AbortController === 'undefined') {
            return fetch(url, opts);
        }
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, timeout);
        var signal = controller.signal;
        var merged = {};
        for (var key in opts) {
            if (Object.prototype.hasOwnProperty.call(opts, key)) merged[key] = opts[key];
        }
        if (merged.signal) {
            var outer = merged.signal;
            merged.signal = signal;
            if (outer.aborted) controller.abort();
            else if (typeof outer.addEventListener === 'function') {
                outer.addEventListener('abort', function () { controller.abort(); }, { once: true });
            }
        } else {
            merged.signal = signal;
        }
        return fetch(url, merged).then(
            function (res) {
                clearTimeout(timer);
                return res;
            },
            function (err) {
                clearTimeout(timer);
                if (err && err.name === 'AbortError') throw timeoutError(timeout);
                throw err;
            },
        );
    }

    /**
     * fetchWithTimeout + JSON parsing.
     * @returns {Promise<any>}
     */
    function fetchJson(url, options, ms) {
        return fetchWithTimeout(url, options, ms).then(function (res) {
            if (!res.ok) {
                var err = new Error('Request failed with status ' + res.status);
                err.status = res.status;
                throw err;
            }
            return res.json();
        });
    }

    var api = {
        DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
        DATASET_TIMEOUT_MS: DATASET_TIMEOUT_MS,
        fetchWithTimeout: fetchWithTimeout,
        fetchJson: fetchJson,
    };

    global.FetchUtils = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(globalThis);
