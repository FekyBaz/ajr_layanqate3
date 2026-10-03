/**
 * Consent banner (see issue #103, PRIVACY.md).
 *
 * Single source: this script renders everything into a placeholder it
 * creates itself, so pages only add one deferred script tag — no per-page
 * markup duplication (same pattern as data-project-share).
 *
 * - Shows once, until the visitor accepts or declines.
 * - Accept → AjrAnalytics.optIn() + remembers choice.
 * - Decline (or Escape) → AjrAnalytics.optOut() + remembers choice.
 * - Never shows when Do-Not-Track is on or a choice already exists.
 * - No-JS visitors never see it — and are never tracked either.
 * - Styling lives in lib/consent.css (external file: CSP has no
 *   'unsafe-inline', so no <style> elements or inline handlers here).
 * - Keyboard accessible (role="region", focusable buttons, Escape).
 *   Focus is intentionally NOT stolen on show.
 */
(function () {
    'use strict';

    var CONSENT_KEY = 'ajr_consent_choice';

    function storageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (_err) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (_err) {
            return false;
        }
    }

    function isDoNotTrack() {
        var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
        return dnt === '1' || dnt === 'yes';
    }

    function choiceMade() {
        return storageGet(CONSENT_KEY) === 'accepted' || storageGet(CONSENT_KEY) === 'declined';
    }

    function analytics() {
        return window.AjrAnalytics || null;
    }

    function ensureStylesheet() {
        if (document.querySelector('link[data-consent-css]')) return;
        var base = document.currentScript && document.currentScript.src
            ? document.currentScript.src.replace(/consent\.js.*$/, '')
            : 'lib/';
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = base + 'consent.css';
        link.setAttribute('data-consent-css', '');
        document.head.appendChild(link);
    }

    function dismiss(banner, choice) {
        var api = analytics();
        if (choice === 'accepted') {
            storageSet(CONSENT_KEY, 'accepted');
            if (api && typeof api.optIn === 'function') api.optIn();
        } else {
            storageSet(CONSENT_KEY, 'declined');
            if (api && typeof api.optOut === 'function') api.optOut();
        }
        if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    }

    function render() {
        // Privacy-safe defaults: never interrupt DNT users or repeat visitors.
        if (isDoNotTrack() || choiceMade()) return;
        var api = analytics();
        if (api && typeof api.isOptedOut === 'function' && api.isOptedOut()) return;

        ensureStylesheet();

        var banner = document.createElement('aside');
        banner.className = 'consent-banner';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'الموافقة على التحليلات');
        banner.setAttribute('data-consent-banner', '');

        var text = document.createElement('p');
        text.className = 'consent-banner__text';
        text.textContent = 'نستخدم تحليلات مجهولة لتحسين الموقع. يمكنك القبول أو الرفض في أي وقت.';

        var actions = document.createElement('div');
        actions.className = 'consent-banner__actions';

        var accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'consent-banner__btn consent-banner__btn--accept';
        accept.textContent = 'أوافق';
        accept.addEventListener('click', function () { dismiss(banner, 'accepted'); });

        var decline = document.createElement('button');
        decline.type = 'button';
        decline.className = 'consent-banner__btn consent-banner__btn--decline';
        decline.textContent = 'أرفض';
        decline.addEventListener('click', function () { dismiss(banner, 'declined'); });

        actions.appendChild(accept);
        actions.appendChild(decline);
        banner.appendChild(text);
        banner.appendChild(actions);
        document.body.appendChild(banner);

        // Escape = privacy-safe decline (documented in PRIVACY.md).
        document.addEventListener('keydown', function onKey(event) {
            if ((event.key === 'Escape' || event.key === 'Esc') && banner.parentNode) {
                document.removeEventListener('keydown', onKey);
                dismiss(banner, 'declined');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render, { once: true });
    } else {
        render();
    }
})();
