(function () {
    'use strict';

    var CONFIG_CACHE_KEY = '__ga_measurement_id';
    var SCRIPT_BASE = 'https://www.googletagmanager.com/gtag/js?id=';

    // Respect the shared opt-out flag and Do-Not-Track (see PRIVACY.md).
    // When set, neither the config fetch nor the gtag script runs.
    function isOptedOut() {
        try {
            if (localStorage.getItem('ajr_analytics_optout') === '1') return true;
        } catch (e) {}
        var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
        return dnt === '1' || dnt === 'yes';
    }

    if (isOptedOut()) return;

    function readCachedConfig() {
        try {
            return sessionStorage.getItem(CONFIG_CACHE_KEY);
        } catch (e) {
            return null;
        }
    }

    var measurementId = readCachedConfig();

    if (measurementId === null) {
        fetch('/api/ga-config')
            .then(function (r) { return r.json(); })
            .then(function (config) {
                measurementId = config.measurement_id || '';
                try { sessionStorage.setItem(CONFIG_CACHE_KEY, measurementId || ''); } catch (e) {}
                if (measurementId) { initGA4(measurementId); }
            })
            .catch(function () {});
    } else if (measurementId) {
        initGA4(measurementId);
    }

    function initGA4(id) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', id, {
            send_page_view: true,
            anonymize_ip: true
        });

        var el = document.createElement('script');
        el.async = true;
        el.src = SCRIPT_BASE + id;
        el.onerror = function () {
            window.__ga4Failed = true;
        };
        document.head.appendChild(el);
    }
})();
