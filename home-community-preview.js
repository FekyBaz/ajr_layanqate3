(function () {
    'use strict';

    const API_ENDPOINT = '/.netlify/functions/community-submissions';
    const REF_ALLOWLIST = ['instagram', 'facebook', 'direct', 'telegram'];

    const elements = {
        menuToggle: document.getElementById('menuToggle'),
        mainMenu: document.getElementById('mainMenu'),
        list: document.getElementById('communityPreviewList'),
        skeleton: document.getElementById('communityPreviewSkeleton'),
        empty: document.getElementById('communityPreviewEmpty'),
        newTodayBadge: document.getElementById('newTodayBadge'),
    };

    function sanitizeRefValue(value) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim().toLowerCase();
        return REF_ALLOWLIST.includes(normalized) ? normalized : null;
    }

    function initializeRefSource() {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = sanitizeRefValue(params.get('ref'));

        if (fromUrl) {
            sessionStorage.setItem('ajr_ref_source', fromUrl);
            return fromUrl;
        }

        return sanitizeRefValue(sessionStorage.getItem('ajr_ref_source')) || 'direct';
    }

    function formatDate(value) {
        return new Intl.DateTimeFormat('ar-EG', {
            day: '2-digit',
            month: 'short',
        }).format(new Date(value));
    }

    function truncateText(value = '', max = 120) {
        if (value.length <= max) return value;
        return `${value.slice(0, max).trim()}…`;
    }

    function resolveMessage(item) {
        return item.corrected_message || item.message || '';
    }

    async function shareSubmission(item) {
        const text = `"${resolveMessage(item)}"\n— ${item.author_name || 'عبدٌ يرجو الأجر'}\nمن مجتمع أجر لا ينقطع 🤍`;

        try {
            if (navigator.share) {
                await navigator.share({ text, url: `${window.location.origin}/community.html` });
                return;
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            }
        } catch {
            // ignore silently to keep homepage lightweight
        }
    }

    function renderCards(submissions, avgPostCount) {
        elements.list.innerHTML = submissions.map((item) => {
            const badge = item.content_type === 'dhikr' ? 'ذكر' : item.content_type === 'dua' ? 'دعاء' : item.content_type === 'ayah' ? 'آية' : 'حديث';
            const isTrending = (Number(item.post_count) || 0) > avgPostCount && Number(item.post_count) > 0;

            return `
                <article class="community-preview-card">
                    <div class="community-preview-card__top">
                        <span class="content-badge badge-${item.content_type}">${badge}</span>
                        ${isTrending ? '<span class="trending-badge">🔥 رائج الآن</span>' : ''}
                    </div>
                    <p>${truncateText(resolveMessage(item), 120)}</p>
                    <div class="community-preview-card__meta">
                        <small>${formatDate(item.created_at)}</small>
                        <button type="button" data-share-id="${item.id}" class="share-btn share-btn--small">📤 مشاركة</button>
                    </div>
                </article>
            `;
        }).join('');

        elements.list.querySelectorAll('[data-share-id]').forEach((button) => {
            button.addEventListener('click', () => {
                const found = submissions.find((row) => String(row.id) === String(button.dataset.shareId));
                if (found) {
                    shareSubmission(found);
                }
            });
        });
    }

    async function loadCommunityPreview() {
        const refSource = initializeRefSource();

        try {
            const params = new URLSearchParams({ page: '1', type: 'all', sort: 'latest', limit: '3' });
            const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
                headers: {
                    'x-ref-source': refSource,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load');
            }

            const result = await response.json();
            const submissions = result.submissions || [];
            const avgPostCount = Number(result.stats?.averagePostCount) || 0;
            const newToday = Number(result.stats?.newApprovedToday) || 0;

            elements.skeleton.hidden = true;

            if (newToday > 0) {
                elements.newTodayBadge.hidden = false;
                elements.newTodayBadge.textContent = `+${newToday} جديد اليوم`;
            }

            if (!submissions.length) {
                elements.empty.hidden = false;
                return;
            }

            elements.list.hidden = false;
            renderCards(submissions, avgPostCount);
        } catch {
            elements.skeleton.hidden = true;
            elements.empty.hidden = false;
            elements.empty.textContent = 'تعذر تحميل أحدث المشاركات الآن.';
        }
    }

    function setupMobileMenu() {
        if (!elements.menuToggle || !elements.mainMenu) return;

        elements.menuToggle.addEventListener('click', () => {
            const expanded = elements.menuToggle.getAttribute('aria-expanded') === 'true';
            elements.menuToggle.setAttribute('aria-expanded', String(!expanded));
            elements.mainMenu.classList.toggle('is-open', !expanded);
        });
    }

    setupMobileMenu();
    window.requestIdleCallback ? requestIdleCallback(loadCommunityPreview) : setTimeout(loadCommunityPreview, 0);
})();
