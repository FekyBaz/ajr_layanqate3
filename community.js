const API_ENDPOINT = '/.netlify/functions/community-submissions';
const VIEW_ENDPOINT = '/.netlify/functions/community-submission-view';
const CTA_INTERVAL = 5;
const REF_ALLOWLIST = ['instagram', 'facebook', 'direct', 'telegram', 'whatsapp_share', 'telegram_share', 'x_share'];
const VIEW_DEBOUNCE_MS = 60_000;
const SHARE_TRACK_ENDPOINT = '/.netlify/functions/community-share-track';
const SESSION_VIEW_KEY = 'ajr_community_view_count';
const SESSION_POPUP_KEY = 'ajr_community_cta_shown';

const badgeLabels = {
    dhikr: 'ذكر',
    dua: 'دعاء',
    ayah: 'آية',
    hadith: 'حديث',
};

const state = {
    type: 'all',
    sort: 'latest',
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0,
    refSource: 'direct',
    viewedIds: new Map(),
    submissionsById: new Map(),
};

const elements = {
    stateMessage: document.getElementById('stateMessage'),
    submissionsContainer: document.getElementById('submissionsContainer'),
    approvedCount: document.getElementById('approvedCount'),
    totalSharesCount: document.getElementById('totalSharesCount'),
    mobileApprovedCount: document.getElementById('mobileApprovedCount'),
    mobileStatsBar: document.getElementById('mobileStatsBar'),
    pagination: document.getElementById('pagination'),
    pageInfo: document.getElementById('pageInfo'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    filterTabs: document.getElementById('filterTabs'),
    sortSelect: document.getElementById('sortSelect'),
    goalSection: document.getElementById('goalSection'),
    goalTarget: document.getElementById('goalTarget'),
    goalProgress: document.getElementById('goalProgress'),
    goalBarFill: document.getElementById('goalBarFill'),
    goalHint: document.getElementById('goalHint'),
    shareToast: document.getElementById('shareToast'),
    joinPopup: document.getElementById('joinPopup'),
    joinPopupClose: document.getElementById('joinPopupClose'),
};

let toastTimeoutId;

function sanitizeRefValue(value) {
    if (typeof value !== 'string') return null;
    const sanitized = value.trim().toLowerCase();
    return REF_ALLOWLIST.includes(sanitized) ? sanitized : null;
}

function initializeRefSource() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = sanitizeRefValue(params.get('ref'));

    if (fromUrl) {
        localStorage.setItem('ajr_ref_source', fromUrl);
        return fromUrl;
    }

    const stored = sanitizeRefValue(localStorage.getItem('ajr_ref_source'));
    return stored || 'direct';
}

function formatDate(dateValue) {
    return new Intl.DateTimeFormat('ar-EG', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date(dateValue));
}

function formatNumber(value) {
    return new Intl.NumberFormat('ar-EG').format(Number(value) || 0);
}

function resolveMessage(item) {
    return item.corrected_message || item.message;
}

function getShareTargetUrl(platform = 'whatsapp') {
    const url = new URL(window.location.origin);
    url.searchParams.set('ref', `${platform}_share`);
    return url.toString();
}

function getShareMessage(item, platform = 'whatsapp') {
    const siteUrl = getShareTargetUrl(platform);
    return `"${resolveMessage(item)}"\n\nمن مشروع أجر لا ينقطع 🤍\n${siteUrl}`;
}

function createCardTop(item, avgPostCount) {
    const top = document.createElement('div');
    top.className = 'submission-card__top';

    const badge = document.createElement('span');
    badge.className = `content-badge badge-${item.content_type}`;
    badge.textContent = badgeLabels[item.content_type] || item.content_type;
    top.appendChild(badge);

    const isTrending = item.post_count > avgPostCount && item.post_count > 0;
    if (isTrending) {
        const trendingBadge = document.createElement('span');
        trendingBadge.className = 'trending-badge';
        trendingBadge.textContent = '🔥 رائج الآن';
        top.appendChild(trendingBadge);
    }

    return top;
}

function renderCtaCard() {
    const cta = document.createElement('aside');
    cta.className = 'community-cta card-enter';
    cta.setAttribute('aria-label', 'دعوة للمشاركة');

    const label = document.createElement('p');
    label.textContent = '🤍 أضف ذكرك أنت أيضًا';
    cta.appendChild(label);

    const link = document.createElement('a');
    link.href = '/index.html#form';
    link.className = 'btn btn-primary';
    link.textContent = 'أضف الآن';
    cta.appendChild(link);

    return cta;
}

function createCard(item, avgPostCount = 0) {
    const card = document.createElement('article');
    card.className = 'submission-card card card-soft card-enter';
    card.dataset.submissionId = String(item.id);
    card.tabIndex = 0;

    card.appendChild(createCardTop(item, avgPostCount));

    const message = document.createElement('p');
    message.className = 'submission-message';
    message.textContent = `"${resolveMessage(item)}"`;
    card.appendChild(message);

    const meta = document.createElement('div');
    meta.className = 'submission-meta';

    const timestamp = document.createElement('time');
    timestamp.dateTime = item.created_at;
    timestamp.textContent = formatDate(item.created_at);
    meta.appendChild(timestamp);

    if (item.post_count > 0) {
        const shares = document.createElement('p');
        shares.className = 'shares';
        shares.textContent = `🕊 تمت المشاركة ${formatNumber(item.post_count)} مرة`;
        meta.appendChild(shares);
    }

    card.appendChild(meta);

    const shareButton = document.createElement('button');
    shareButton.className = 'share-btn btn btn-ghost';
    shareButton.type = 'button';
    shareButton.dataset.shareId = String(item.id);
    shareButton.textContent = '📤 شارك هذا الذكر';
    card.appendChild(shareButton);

    return card;
}

function showToast() {
    elements.shareToast.hidden = false;
    elements.shareToast.classList.add('is-visible');
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
        elements.shareToast.classList.remove('is-visible');
        elements.shareToast.hidden = true;
    }, 1800);
}

function showSubmissionReviewToastIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    const hasSubmissionFlag = params.get('submitted') === '1' || sessionStorage.getItem('ajr_submission_pending_review') === '1';

    if (!hasSubmissionFlag) return;

    elements.shareToast.textContent = 'تم إضافة ذكرك للمراجعة 🤍';
    showToast();
    sessionStorage.removeItem('ajr_submission_pending_review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function maybeShowJoinPopup() {
    const viewedCount = Number(sessionStorage.getItem(SESSION_VIEW_KEY) || '0');
    const alreadyShown = sessionStorage.getItem(SESSION_POPUP_KEY) === '1';

    if (viewedCount < 3 || alreadyShown || !elements.joinPopup) {
        return;
    }

    elements.joinPopup.hidden = false;
    sessionStorage.setItem(SESSION_POPUP_KEY, '1');
}

function incrementSessionViewCount() {
    const nextCount = Number(sessionStorage.getItem(SESSION_VIEW_KEY) || '0') + 1;
    sessionStorage.setItem(SESSION_VIEW_KEY, String(nextCount));
    maybeShowJoinPopup();
}

async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

async function trackShare(platform, submissionId) {
    try {
        await fetch(SHARE_TRACK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ platform, submissionId }),
        });
    } catch {
        // lightweight tracking only
    }
}

async function shareSubmission(item) {
    const preferredPlatform = 'whatsapp';
    const shareText = getShareMessage(item, preferredPlatform);

    try {
        if (navigator.share) {
            await navigator.share({ text: shareText, url: getShareTargetUrl(preferredPlatform) });
            await trackShare('native', item.id);
            return;
        }

        await copyToClipboard(shareText);
        await trackShare(preferredPlatform, item.id);
        showToast();
    } catch (err) {
        if (err?.name !== 'AbortError') {
            try {
                await copyToClipboard(shareText);
                await trackShare(preferredPlatform, item.id);
                showToast();
            } catch (copyErr) {
                console.error('[community] Share failed after fallback', { err, copyErr, submissionId: item?.id });
            }
        }
    }
}

async function incrementView(submissionId) {
    const now = Date.now();
    const lastViewedAt = state.viewedIds.get(submissionId) || 0;

    if (now - lastViewedAt < VIEW_DEBOUNCE_MS) {
        return;
    }

    state.viewedIds.set(submissionId, now);
    incrementSessionViewCount();

    try {
        await fetch(VIEW_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ submissionId }),
        });
    } catch (err) {
        // Silently fail for lightweight analytics
    }
}

function buildCards(submissions, avgPostCount) {
    const fragment = document.createDocumentFragment();

    submissions.forEach((item, index) => {
        fragment.appendChild(createCard(item, avgPostCount));

        if ((index + 1) % CTA_INTERVAL === 0 && index !== submissions.length - 1) {
            fragment.appendChild(renderCtaCard());
        }
    });

    return fragment;
}

async function fetchSubmissions() {
    elements.stateMessage.textContent = 'جارٍ تحميل المشاركات...';
    elements.stateMessage.hidden = false;
    elements.submissionsContainer.innerHTML = '';

    const query = new URLSearchParams({
        page: String(state.page),
        limit: String(state.limit),
        type: state.type,
        sort: state.sort,
        surface: 'community',
    });

    try {
        const response = await fetch(`${API_ENDPOINT}?${query.toString()}`, {
            headers: {
                'x-ref-source': state.refSource,
            },
        });

        if (!response.ok) {
            throw new Error('Request failed');
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Unexpected API response');
        }


        console.debug('[community] response payload', {
            submissions: Array.isArray(result.submissions) ? result.submissions.length : 0,
            total: result.pagination?.total,
            totalPages: result.pagination?.totalPages,
            page: result.pagination?.page,
            type: state.type,
            sort: state.sort,
        });

        renderResponse(result);
    } catch (err) {
        elements.stateMessage.textContent = 'تعذر تحميل المشاركات حاليًا. حاول مرة أخرى لاحقًا.';
        elements.pagination.hidden = true;
    }
}

function renderGoal(goal = {}) {
    if (!elements.goalSection || !elements.goalTarget || !elements.goalProgress || !elements.goalBarFill) return;

    const dailyTarget = Math.max(Number(goal.dailyTarget) || 0, 1);
    const currentProgress = Math.max(Number(goal.currentProgress) || 0, 0);
    const percent = Math.min(Math.round((currentProgress / dailyTarget) * 100), 100);

    elements.goalTarget.textContent = `🎯 هدف اليوم: ${formatNumber(dailyTarget)} ذكر`;
    elements.goalProgress.textContent = `🤍 تم تحقيق: ${formatNumber(currentProgress)}`;
    elements.goalBarFill.style.width = `${percent}%`;
    if (elements.goalHint) {
        elements.goalHint.textContent = goal.hint || 'هدف اليوم يتجدد كل صباح 🤍';
    }
    elements.goalSection.querySelector('.community-goal__bar')?.setAttribute('aria-valuenow', String(percent));
    elements.goalSection.hidden = false;
}

function renderStats(stats = {}, pagination = {}) {
    const totalApproved = stats.totalApproved || pagination.total || 0;
    const totalShares = stats.totalPostCount || 0;

    elements.approvedCount.textContent = `🤍 ${formatNumber(totalApproved)} مشاركة معتمدة`;
    elements.totalSharesCount.textContent = `📿 ${formatNumber(totalShares)} مرة تم نشر الأذكار`;
    elements.mobileApprovedCount.textContent = `🤍 ${formatNumber(totalApproved)} مشاركة`;
    elements.mobileStatsBar.hidden = false;
}

function cacheSubmissions(submissions = []) {
    state.submissionsById.clear();
    submissions.forEach((item) => state.submissionsById.set(Number(item.id), item));
}

function renderResponse(result) {
    const { submissions, pagination, stats } = result;
    const avgPostCount = Number(stats?.averagePostCount) || 0;
    state.totalPages = Math.max(Number(pagination?.totalPages) || 1, 1);
    state.total = Number(pagination?.total) || 0;
    state.page = Math.min(Math.max(Number(pagination?.page) || state.page, 1), state.totalPages);

    cacheSubmissions(submissions);
    renderStats(stats, pagination);
    renderGoal(stats?.goal || {});

    if (!submissions.length) {
        if (state.total === 0) {
            elements.stateMessage.textContent = 'لا توجد مشاركات معتمدة ضمن هذا التصنيف حتى الآن.';
            elements.pagination.hidden = true;
            return;
        }

        elements.stateMessage.textContent = 'جارٍ إعادة ضبط الصفحة تلقائيًا...';
        elements.pagination.hidden = true;
        return;
    }

    elements.stateMessage.hidden = true;
    elements.submissionsContainer.innerHTML = '';
    elements.submissionsContainer.appendChild(buildCards(submissions, avgPostCount));

    elements.pagination.hidden = false;
    elements.pageInfo.textContent = `صفحة ${state.page} من ${state.totalPages}`;
    elements.prevPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= state.totalPages;
}

function setActiveTab(type) {
    document.querySelectorAll('.tab').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.type === type);
    });
}

elements.filterTabs.addEventListener('click', (event) => {
    const button = event.target.closest('.tab');
    if (!button) return;

    state.type = button.dataset.type;
    state.page = 1;
    setActiveTab(state.type);
    fetchSubmissions();
});

elements.sortSelect.addEventListener('change', (event) => {
    state.sort = event.target.value;
    state.page = 1;
    fetchSubmissions();
});

function scrollToSubmissions() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

elements.prevPage.addEventListener('click', () => {
    if (state.page > 1) {
        state.page -= 1;
        fetchSubmissions();
        scrollToSubmissions();
    }
});

elements.nextPage.addEventListener('click', () => {
    if (state.page < state.totalPages) {
        state.page += 1;
        fetchSubmissions();
        scrollToSubmissions();
    }
});

elements.communityPage = document.querySelector('.community-page');

elements.communityPage.addEventListener('click', async (event) => {
    const shareButton = event.target.closest('[data-share-id]');
    if (shareButton) {
        event.preventDefault();
        event.stopPropagation();
        const submissionId = Number(shareButton.dataset.shareId);
        const selected = state.submissionsById.get(submissionId);
        if (!selected) return;

        await shareSubmission(selected);
        return;
    }

    const clickedCard = event.target.closest('.submission-card[data-submission-id]');
    if (clickedCard && !event.target.closest('a, button, select, option')) {
        await incrementView(Number(clickedCard.dataset.submissionId));
    }
});

elements.submissionsContainer.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const card = event.target.closest('[data-submission-id]');
    if (!card) return;

    event.preventDefault();
    await incrementView(Number(card.dataset.submissionId));
});

if (elements.joinPopupClose) {
    elements.joinPopupClose.addEventListener('click', () => {
        elements.joinPopup.hidden = true;
    });
}

state.refSource = initializeRefSource();
showSubmissionReviewToastIfNeeded();
fetchSubmissions();
