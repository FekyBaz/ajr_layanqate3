(function () {
    'use strict';

    var CONFIG_CACHE_KEY = '__ga_measurement_id';
    var SCRIPT_BASE = 'https://www.googletagmanager.com/gtag/js?id=';

    var measurementId = sessionStorage.getItem(CONFIG_CACHE_KEY);

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
