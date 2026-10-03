(function () {
    'use strict';

    const API_ENDPOINT = '/.netlify/functions/community-submissions';
    const REF_ALLOWLIST = ['instagram', 'facebook', 'direct', 'telegram', 'whatsapp_share', 'telegram_share', 'x_share'];

    const elements = {
        menuToggle: document.getElementById('menuToggle'),
        mainMenu: document.getElementById('mainMenu'),
        list: document.getElementById('communityPreviewList'),
        skeleton: document.getElementById('communityPreviewSkeleton'),
        empty: document.getElementById('communityPreviewEmpty'),
        newTodayBadge: document.getElementById('newTodayBadge'),
        dailyFeatureCard: document.getElementById('dailyFeatureCard'),
        dailyFeatureText: document.getElementById('dailyFeatureText'),
        dailyFeatureShare: document.getElementById('dailyFeatureShare'),
        dailyChangeLine: document.getElementById('dailyChangeLine'),
    };

    const HOME_PREVIEW_SCOPE_CLASS = 'home-community-preview';

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
    function resolveMessage(item) {
        return item.corrected_message || item.message || '';
    }

    // Single sources: lib/escape.js + lib/share.js (loaded before this script),
    // with fallbacks so the preview still works if a shared lib is missing.
    const Escape = globalThis.EscapeLib || {
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
    };

    function escapeHtml(text) {
        return Escape.escapeHtml(text);
    }

    function getDailyDateLine() {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
        const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
        return `اليوم:<br>${formatted}<br><br>الموافق:<br>${hijri}`;
    }

    function renderDailyFeature(dailyFeature) {
        if (elements.dailyChangeLine) {
            elements.dailyChangeLine.innerHTML = getDailyDateLine();
        }

        const submission = dailyFeature?.submission;
        if (!submission || !elements.dailyFeatureCard || !elements.dailyFeatureText || !elements.dailyFeatureShare) return;

        elements.dailyFeatureText.textContent = `"${resolveMessage(submission)}"`;
        elements.dailyFeatureCard.hidden = false;
        elements.dailyFeatureShare.addEventListener('click', () => shareSubmission(submission));
    }

    async function shareSubmission(item) {
        const text = `"${resolveMessage(item)}"\n\nمن مشروع أجر لا ينقطع\n${window.location.origin}`;

        // Single source: lib/share.js when available
        if (globalThis.ShareLib) {
            await globalThis.ShareLib.shareOrCopy({
                text,
                url: `${window.location.origin}/community.html`,
            });
            return;
        }

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
        const previewItems = submissions.slice(0, 3);
        const VALID_TYPES = ['dhikr', 'dua', 'ayah', 'hadith', 'benefit'];
        elements.list.innerHTML = previewItems.map((item) => {
            const badgeMap = { dhikr: 'ذكر', dua: 'دعاء', ayah: 'آية', hadith: 'حديث', benefit: 'فائدة' };
            const safeType = VALID_TYPES.includes(item.content_type) ? item.content_type : 'dhikr';
            const badge = badgeMap[safeType] || 'مشاركة';
            const isTrending = (Number(item.post_count) || 0) > avgPostCount && Number(item.post_count) > 0;
            const safeId = escapeHtml(String(item.id));
            const safeMessage = escapeHtml(resolveMessage(item));

            return `
                <article class="community-preview-card card card-outline">
                    <div class="community-preview-card__top">
                        <span class="content-badge badge-${safeType}">${badge}</span>
                        ${isTrending ? '<span class="trending-badge">🔥 رائج الآن</span>' : ''}
                    </div>
                    <p>${safeMessage}</p>
                    <a class="community-preview-card__full-link" href="/community.html#submission-${safeId}">عرض كامل →</a>
                    <div class="community-preview-card__meta">
                        <small>${formatDate(item.created_at)}</small>
                        <button type="button" data-share-id="${safeId}" class="share-btn share-btn--small btn btn-ghost">📤 مشاركة</button>
                    </div>
                </article>
            `;
        }).join('');

        elements.list.querySelectorAll('[data-share-id]').forEach((button) => {
            button.addEventListener('click', () => {
                const found = previewItems.find((row) => String(row.id) === String(button.dataset.shareId));
                if (found) {
                    shareSubmission(found);
                }
            });
        });
    }

    function applyPreviewScopeClass() {
        const previewSection = elements.list?.closest('.community-preview');
        if (!previewSection) return;
        previewSection.classList.add(HOME_PREVIEW_SCOPE_CLASS);
    }

    async function loadCommunityPreview() {
        const refSource = initializeRefSource();

        try {
            const params = new URLSearchParams({ page: '1', type: 'all', sort: 'latest', limit: '3', surface: 'homepage_preview' });
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
            const total = Number(result.pagination?.total) || 0;
            renderDailyFeature(result.dailyFeature);

            console.debug('[home-preview] payload shape', {
                submissions: submissions.length,
                total,
                page: result.pagination?.page,
            });

            elements.skeleton.hidden = true;

            if (newToday > 0) {
                elements.newTodayBadge.hidden = false;
                elements.newTodayBadge.textContent = `+${newToday} جديد اليوم`;
            }

            if (!submissions.length && total === 0) {
                elements.empty.hidden = false;
                return;
            }

            if (!submissions.length) {
                elements.empty.hidden = false;
                elements.empty.textContent = 'لا تتوفر عناصر في هذه الصفحة حاليًا.';
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

        // Use shared accessible helper when available (see lib/mobile-nav.js)
        if (typeof window.initMobileNav === 'function') {
            window.initMobileNav({ toggleId: 'menuToggle', menuId: 'mainMenu' });
            return;
        }

        elements.menuToggle.addEventListener('click', () => {
            const expanded = elements.menuToggle.getAttribute('aria-expanded') === 'true';
            elements.menuToggle.setAttribute('aria-expanded', String(!expanded));
            elements.menuToggle.setAttribute('aria-label', !expanded ? 'إغلاق القائمة' : 'فتح القائمة');
            elements.mainMenu.classList.toggle('is-open', !expanded);
            if (!expanded) {
                const firstLink = elements.mainMenu.querySelector('a[href]');
                if (firstLink) firstLink.focus();
            }
        });

        document.addEventListener('keydown', (event) => {
            if ((event.key === 'Escape' || event.key === 'Esc') &&
                elements.menuToggle.getAttribute('aria-expanded') === 'true') {
                event.stopPropagation();
                elements.menuToggle.setAttribute('aria-expanded', 'false');
                elements.menuToggle.setAttribute('aria-label', 'فتح القائمة');
                elements.mainMenu.classList.remove('is-open');
                elements.menuToggle.focus();
            }
        });

        document.addEventListener('click', (event) => {
            if (elements.menuToggle.getAttribute('aria-expanded') !== 'true') return;
            if (elements.menuToggle.contains(event.target) || elements.mainMenu.contains(event.target)) return;
            elements.menuToggle.setAttribute('aria-expanded', 'false');
            elements.menuToggle.setAttribute('aria-label', 'فتح القائمة');
            elements.mainMenu.classList.remove('is-open');
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 769 &&
                elements.menuToggle.getAttribute('aria-expanded') === 'true') {
                elements.menuToggle.setAttribute('aria-expanded', 'false');
                elements.menuToggle.setAttribute('aria-label', 'فتح القائمة');
                elements.mainMenu.classList.remove('is-open');
            }
        });
    }

    setupMobileMenu();
    applyPreviewScopeClass();
    window.requestIdleCallback ? requestIdleCallback(loadCommunityPreview) : setTimeout(loadCommunityPreview, 0);
})();
