/**
 * أجر لا ينقطع - community-posters.js
 * Renders the Dhikr Poster Gallery on community.html.
 * Loads user-published posters from localStorage; seeds with beautiful
 * pre-made example cards when none exist yet.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'ajr_community_posters';

    // Seed posters displayed when user has published nothing yet
    const SEED_POSTERS = [
        {
            id: 'seed_1',
            dataUrl: null,
            imgSrc: 'poster/seed-1.png',
            text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ ، سُبْحَانَ اللَّهِ الْعَظِيمِ',
            theme: 'night-spiritual',
            timestamp: null,
            isSeed: true
        },
        {
            id: 'seed_2',
            dataUrl: null,
            imgSrc: 'poster/seed-2.png',
            text: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
            theme: 'paradise-spring',
            timestamp: null,
            isSeed: true
        },
        {
            id: 'seed_3',
            dataUrl: null,
            imgSrc: 'poster/seed-3.png',
            text: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
            theme: 'premium-gold',
            timestamp: null,
            isSeed: true
        }
    ];

    const THEME_NAMES = {
        'night-spiritual': 'سكون الليل',
        'nature-serenity': 'صفاء الطبيعة',
        'minimal-noor': 'نور هادئ',
        'premium-gold': 'مذهب راقٍ',
        'paradise-spring': 'ربيع الجنة'
    };

    function loadGallery() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch { /* ignore */ }
        return null; // Will use seeds
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str || '');
        return div.innerHTML;
    }

    function buildCard(entry) {
        const imgSrc = entry.imgSrc || entry.dataUrl;
        const caption = escapeHtml((entry.text || '').slice(0, 80));
        const themeName = escapeHtml(THEME_NAMES[entry.theme] || entry.theme || '');
        const badgeHtml = themeName
            ? `<span class="community-poster-card__badge">${themeName}</span>`
            : '';
        const seedNote = entry.isSeed
            ? `<a href="poster.html" style="display:block;text-align:center;font-size:0.72rem;padding:4px 0;color:#3E7B5C;text-decoration:none;">✨ صمّم بطاقتك</a>`
            : '';

        return `
            <article class="community-poster-card" role="img" aria-label="${caption}">
                ${badgeHtml}
                <img src="${escapeHtml(imgSrc)}" alt="${caption}" loading="lazy">
                <p class="community-poster-card__caption">${caption}</p>
                ${seedNote}
            </article>
        `;
    }

    function render() {
        const communityGrid = document.getElementById('communityPostersGrid');
        const homeGrid = document.getElementById('homePostersGrid');
        const empty = document.getElementById('communityPostersEmpty');

        const userPosters = loadGallery();
        const allEntries = userPosters || SEED_POSTERS;

        // Render full gallery on community page
        if (communityGrid) {
            if (!allEntries.length) {
                if (empty) empty.hidden = false;
            } else {
                communityGrid.innerHTML = allEntries.map(buildCard).join('');
                if (empty) empty.hidden = true;
            }
        }

        // Render top 3 on homepage
        if (homeGrid) {
            const preview = allEntries.slice(0, 3);
            homeGrid.innerHTML = preview.map(buildCard).join('');
        }
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
