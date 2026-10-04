/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Home: Recent Memorial Pages Preview
 * Fetches and renders up to 3 recently approved memorial pages on homepage.
 * No counters, no ranking — calm and respectful.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    // Single source: lib/config.js (loaded before this script)
    const API_BASE = window.AppConfig.API_BASE;

    // Timeout-bounded fetch (lib/fetch-utils.js when loaded, see #145).
    function timedFetch(url, options) {
        if (globalThis.FetchUtils) return globalThis.FetchUtils.fetchWithTimeout(url, options);
        return fetch(url, options);
    }

    const listEl = document.getElementById('recentMemoriesList');
    const emptyEl = document.getElementById('recentMemoriesEmpty');

    if (!listEl || !emptyEl) return;

    async function loadRecentMemories() {
        try {
            const response = await timedFetch(`${API_BASE}/api/memories/recent`);
            const result = await response.json();

            if (!result.success || !result.data || result.data.length === 0) {
                emptyEl.hidden = false;
                return;
            }

            result.data.forEach(memory => {
                const card = document.createElement('div');
                card.className = 'recent-memories__card';

                const name = document.createElement('h3');
                name.className = 'recent-memories__name';
                name.textContent = memory.deceased_name;

                const sub = document.createElement('p');
                sub.className = 'recent-memories__subtitle';
                sub.textContent = `صدقة جارية على روح ${memory.deceased_name}`;

                const link = document.createElement('a');
                link.className = 'btn btn-secondary recent-memories__btn';
                link.href = `/memory/${encodeURIComponent(memory.slug)}`;
                link.textContent = 'عرض الصفحة';

                card.appendChild(name);
                card.appendChild(sub);
                card.appendChild(link);
                listEl.appendChild(card);
            });

            listEl.hidden = false;

        } catch (err) {
            // Silent fail — section just stays hidden
            emptyEl.hidden = false;
        }
    }

    loadRecentMemories();
})();
