/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع — Product Analytics Tracker
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lightweight, privacy-first analytics tracking.
 * ~2KB gzipped. Uses navigator.sendBeacon for reliable delivery.
 *
 * Usage:
 *   import { track, trackPageView, onReady } from '/lib/analytics.js';
 *   trackPageView();
 *   track('share_click', { platform: 'whatsapp' });
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════
    const ANALYTICS_ENDPOINT = '/api/analytics';
    const SESSION_STORAGE_KEY = 'ajr_analytics_session';
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const RETURNING_COOKIE_KEY = 'ajr_returning';
    const BEACON_QUEUE_MAX = 10;
    const OPT_OUT_KEY = 'ajr_analytics_optout';

    // ═══════════════════════════════════════════════════════════════════
    // Opt-out & Do-Not-Track (see PRIVACY.md)
    // ═══════════════════════════════════════════════════════════════════

    function isDoNotTrack() {
        const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
        return dnt === '1' || dnt === 'yes';
    }

    function isOptedOut() {
        try {
            if (localStorage.getItem(OPT_OUT_KEY) === '1') return true;
        } catch {
            // Storage unavailable — fall through to DNT
        }
        return isDoNotTrack();
    }

    // Secure flag on HTTPS only (localhost stays working over HTTP).
    function cookieSuffix() {
        try {
            return window.location.protocol === 'https:'
                ? ';SameSite=Lax; Secure'
                : ';SameSite=Lax';
        } catch {
            return ';SameSite=Lax';
        }
    }

    function setOptedOut(value) {
        try {
            if (value) {
                localStorage.setItem(OPT_OUT_KEY, '1');
                // Drop the repeat-visitor marker immediately
                document.cookie = `${RETURNING_COOKIE_KEY}=;max-age=0;path=/${cookieSuffix()}`;
            } else {
                localStorage.removeItem(OPT_OUT_KEY);
            }
        } catch {
            // Storage unavailable — nothing to persist
        }
        return isOptedOut();
    }

    // Evaluated once at load: no session, no cookie, no beacons when set.
    const TRACKING_DISABLED = isOptedOut();

    // ═══════════════════════════════════════════════════════════════════
    // Session Management
    // ═══════════════════════════════════════════════════════════════════

    function generateSessionId() {
        // Anonymous session ID — no personal data
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    function getSession() {
        try {
            const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (stored) {
                const session = JSON.parse(stored);
                // Check if session is still valid
                if (Date.now() - session.createdAt < SESSION_TIMEOUT_MS) {
                    return session;
                }
            }
        } catch {
            // Storage unavailable — continue without persistence
        }

        // Create new session
        const isReturning = document.cookie.indexOf(RETURNING_COOKIE_KEY) !== -1;
        const session = {
            id: generateSessionId(),
            createdAt: Date.now(),
            isReturning: isReturning,
        };

        try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        } catch {
            // Storage full or unavailable
        }

        // Mark as returning for future visits
        try {
            document.cookie = `${RETURNING_COOKIE_KEY}=1;max-age=31536000;path=/${cookieSuffix()}`;
        } catch {
            // Cookies disabled
        }

        return session;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Device Detection
    // ═══════════════════════════════════════════════════════════════════

    function getDeviceInfo() {
        const ua = navigator.userAgent.toLowerCase();
        let deviceType = 'desktop';
        if (/mobile|android|iphone|ipod/i.test(ua)) deviceType = 'mobile';
        else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';

        return {
            deviceType,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            language: navigator.language || navigator.userLanguage,
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // UTM Parameter Extraction
    // ═══════════════════════════════════════════════════════════════════

    function getUTMParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            utm_source: params.get('utm_source'),
            utm_medium: params.get('utm_medium'),
            utm_campaign: params.get('utm_campaign'),
            utm_content: params.get('utm_content'),
            utm_term: params.get('utm_term'),
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Event Building & Sending
    // ═══════════════════════════════════════════════════════════════════

    // No session or cookie is created when tracking is disabled.
    const session = TRACKING_DISABLED
        ? { id: null, createdAt: 0, isReturning: false }
        : getSession();
    const deviceInfo = getDeviceInfo();
    const utmParams = getUTMParams();
    let eventQueue = [];
    let flushTimer = null;

    function buildEvent(type, name, data) {
        return {
            type,
            name: name || type,
            data: data || {},
            session_id: session.id,
            is_returning: session.isReturning,
            page_path: window.location.pathname,
            page_title: document.title,
            referrer: document.referrer,
            ...utmParams,
            ...deviceInfo,
        };
    }

    function sendEvents(events) {
        if (!events || events.length === 0) return;

        const payload = JSON.stringify(events);

        // Use sendBeacon if available (survives page navigation)
        if (navigator.sendBeacon) {
            try {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
                return;
            } catch {
                // Fall through to fetch
            }
        }

        // Fallback: fetch with keepalive
        try {
            fetch(ANALYTICS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
            });
        } catch {
            // Analytics failed — silently ignore (non-critical)
        }
    }

    /**
     * Queue an analytics event.
     * Events are batched and flushed periodically or on page unload.
     *
     * @param {string} type - Event type (e.g., 'page_view', 'click', 'share')
     * @param {string} [name] - Human-readable event name
     * @param {Object} [data] - Additional event data
     */
    function track(type, name, data) {
        if (TRACKING_DISABLED) return;
        const event = buildEvent(type, name, data);
        eventQueue.push(event);

        // Flush immediately for important events
        if (type === 'page_view' || type === 'submit' || type === 'error') {
            flush();
        }

        // Auto-flush if queue gets large
        if (eventQueue.length >= BEACON_QUEUE_MAX) {
            flush();
        }
    }

    function flush() {
        if (eventQueue.length === 0) return;

        const batch = eventQueue.splice(0, eventQueue.length);
        sendEvents(batch);
    }

    // Flush on page unload
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);

    // Periodic flush for long-lived pages
    setInterval(flush, 10000);

    // ═══════════════════════════════════════════════════════════════════
    // Convenience Trackers
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Track a page view. Called automatically on load.
     */
    function trackPageView() {
        track('page_view', 'page_view', {
            load_time_ms: performance.now ? Math.round(performance.now()) : null,
        });
    }

    /**
     * Track a CTA click.
     * @param {string} ctaName - Name of the CTA (e.g., 'submit_dhikr', 'view_community')
     * @param {Element} [element] - The clicked element
     */
    function trackCTA(ctaName, element) {
        track('cta_click', ctaName, {
            element_tag: element?.tagName,
            element_text: element?.textContent?.slice(0, 50),
        });
    }

    /**
     * Track a share action.
     * @param {string} platform - Share platform (whatsapp, telegram, x, native)
     * @param {string} [contentType] - What was shared (memory, dhikr, page)
     */
    function trackShare(platform, contentType) {
        track('share', 'share_' + platform, {
            platform,
            content_type: contentType,
        });
    }

    /**
     * Track a form submission.
     * @param {string} formType - Type of form (submission, memory, contact)
     * @param {boolean} success - Whether submission succeeded
     */
    function trackFormSubmit(formType, success) {
        track(success ? 'submit' : 'form_abandon', formType + '_submit', {
            form_type: formType,
            success,
        });
    }

    /**
     * Track scroll depth (called once per threshold).
     * @param {number} depth - Scroll depth percentage (25, 50, 75, 100)
     */
    function trackScroll(depth) {
        track('scroll', 'scroll_' + depth + 'pct', { depth });
    }

    /**
     * Track a frontend error.
     * @param {string} message - Error message
     * @param {string} [file] - Source file
     * @param {number} [line] - Line number
     */
    function trackError(message, file, line) {
        track('error', 'js_error', {
            message: message?.slice(0, 200),
            file: file?.slice(0, 100),
            line,
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Automatic Tracking Setup
    // ═══════════════════════════════════════════════════════════════════

    function setupAutomaticTracking() {
        if (TRACKING_DISABLED) return;
        // Skip tracking for admin and analytics dashboard pages
        var path = window.location.pathname;
        if (path.indexOf('/admin') === 0 || path.indexOf('/analytics') === 0) {
            return;
        }

        // Track page view on load
        trackPageView();

        // Track scroll depth (throttled)
        let scrollThresholds = [25, 50, 75, 100];
        let scrollTracked = new Set();

        function onScroll() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (docHeight <= 0) return;

            const depth = Math.round((scrollTop / docHeight) * 100);

            for (const threshold of scrollThresholds) {
                if (depth >= threshold && !scrollTracked.has(threshold)) {
                    scrollTracked.add(threshold);
                    trackScroll(threshold);
                }
            }
        }

        // Throttled scroll listener
        let scrollTick = false;
        window.addEventListener('scroll', function () {
            if (!scrollTick) {
                scrollTick = true;
                requestAnimationFrame(function () {
                    onScroll();
                    scrollTick = false;
                });
            }
        }, { passive: true });

        // Track outbound link clicks
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.href;
            if (!href) return;

            try {
                const url = new URL(href, window.location.origin);
                // Outbound = different hostname
                if (url.hostname !== window.location.hostname) {
                    track('outbound_click', 'outbound_link', {
                        url: url.hostname,
                        link_text: link.textContent?.slice(0, 50),
                    });
                }
            } catch {
                // Invalid URL — ignore
            }
        }, { passive: true });

        // Track share button clicks
        document.addEventListener('click', function (e) {
            const shareBtn = e.target.closest('[data-share-platform]');
            if (!shareBtn) return;

            trackShare(shareBtn.dataset.sharePlatform, 'page');
        }, { passive: true });

        // Track CTA clicks
        document.addEventListener('click', function (e) {
            const cta = e.target.closest('[data-analytics-cta]');
            if (!cta) return;

            trackCTA(cta.dataset.analyticsCta, cta);
        }, { passive: true });

        // Track form submissions
        document.addEventListener('submit', function (e) {
            const form = e.target;
            if (!form.id) return;

            const formType = form.id.replace('-form', '').replace('submission', 'dhikr');
            // Track form start — success tracked by individual form handlers
            track('form_start', formType + '_start');
        }, { passive: true });

        // Global error tracking
        window.addEventListener('error', function (e) {
            // Only track errors from our own code (not CDN errors)
            if (e.filename && e.filename.includes(window.location.hostname)) {
                trackError(e.message, e.filename, e.lineno);
            }
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', function (e) {
            trackError(String(e.reason)?.slice(0, 200), 'promise', 0);
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════════════════════════════

    window.AjrAnalytics = {
        track,
        trackPageView,
        trackCTA,
        trackShare,
        trackFormSubmit,
        trackScroll,
        trackError,
        getSessionId: () => session.id,
        isReturning: () => session.isReturning,
        flush,
        isOptedOut,
        optOut: () => setOptedOut(true),
        optIn: () => setOptedOut(false),
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupAutomaticTracking);
    } else {
        setupAutomaticTracking();
    }

})();
