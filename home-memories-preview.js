/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Home: Recent Memorial Pages Preview
 * Fetches and renders up to 3 recently approved memorial pages on homepage.
 * No counters, no ranking — calm and respectful.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    const PRODUCTION_API_URL = '';
    const isProduction = !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1');
    const API_BASE = isProduction ? PRODUCTION_API_URL : 'http://localhost:8888';

    const listEl = document.getElementById('recentMemoriesList');
    const emptyEl = document.getElementById('recentMemoriesEmpty');

    if (!listEl || !emptyEl) return;

    async function loadRecentMemories() {
        try {
            const response = await fetch(`${API_BASE}/api/memories/recent`);
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
                sub.textContent = 'صدقة جارية على روح...';

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
