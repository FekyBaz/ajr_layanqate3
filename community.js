const API_ENDPOINT = '/.netlify/functions/community-submissions';
const VIEW_ENDPOINT = '/.netlify/functions/community-submission-view';
const REF_ALLOWLIST = ['instagram', 'facebook', 'direct', 'telegram', 'whatsapp_share', 'telegram_share', 'x_share'];
const VIEW_DEBOUNCE_MS = 60_000;
const SHARE_TRACK_ENDPOINT = '/.netlify/functions/community-share-track';
const SESSION_VIEW_KEY = 'ajr_community_view_count';
const SESSION_POPUP_KEY = 'ajr_community_cta_shown';

// Timeout-bounded fetch (lib/fetch-utils.js when loaded, see #145).
function timedFetch(url, options) {
    if (globalThis.FetchUtils) return globalThis.FetchUtils.fetchWithTimeout(url, options);
    return fetch(url, options);
}

const STORAGE_KEYS = {
    savedIds: 'ajr_community_saved_ids',
    focusMode: 'ajr_community_focus_mode',
    lastFilter: 'ajr_community_last_filter',
    lastVisitDate: 'ajr_community_last_visit_date',
};

const badgeLabels = {
    dhikr: 'ذكر',
    dua: 'دعاء',
    ayah: 'آية',
    hadith: 'حديث',
    benefit: 'فائدة',
};

const COMMUNITY_INVITE_CARD = {
    contentType: 'benefit',
    message: 'أضف ذكرك أنت أيضًا\nشاركنا ذكرًا نافعًا بلطف، ليصل أثره إلى قلوب أكثر.',
    ctaText: 'أضف الآن',
    formUrl: '/index.html#form',
};

const state = {
    type: 'all',
    sort: 'latest',
    page: 1,
    limit: 12,
    totalPages: 1,
    total: 0,
    refSource: 'direct',
    viewedIds: new Map(),
    submissionsById: new Map(),
    savedIds: new Set(),
    focusMode: false,
    stats: {
        totalPostCount: 0,
        totalApproved: 0,
    },
    hashTargetSubmissionId: null,
    hasHandledHashTarget: false,
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
    shareToast: document.getElementById('shareToast'),
    joinPopup: document.getElementById('joinPopup'),
    joinPopupClose: document.getElementById('joinPopupClose'),
    focusModeToggle: document.getElementById('focusModeToggle'),
    returnMemory: document.getElementById('returnMemory'),
    savedItems: document.getElementById('savedItems'),
    savedEmptyMessage: document.getElementById('savedEmptyMessage'),
    savedTasteMessage: document.getElementById('savedTasteMessage'),
};

let toastTimeoutId;

function storageAvailable() {
    try {
        const key = '__ajr_storage_test__';
        localStorage.setItem(key, key);
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

const canUseStorage = storageAvailable();

function safeStorageGet(key) {
    if (!canUseStorage) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeStorageSet(key, value) {
    if (!canUseStorage) return;
    try {
        localStorage.setItem(key, value);
    } catch {
        // graceful fallback in restrictive environments
    }
}

function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

function loadSavedIds() {
    const raw = safeStorageGet(STORAGE_KEYS.savedIds);
    if (!raw) return new Set();

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();

        return new Set(
            parsed
                .map((id) => (typeof id === 'string' ? id.trim() : String(id || '').trim()))
                .filter(Boolean),
        );
    } catch {
        return new Set();
    }
}

function persistSavedIds() {
    const clipped = Array.from(state.savedIds)
        .map((id) => (typeof id === 'string' ? id.trim() : String(id || '').trim()))
        .filter(Boolean)
        .slice(0, 10);

    state.savedIds = new Set(clipped);

    try {
        safeStorageSet(STORAGE_KEYS.savedIds, JSON.stringify(clipped));
    } catch (err) {
        console.warn('[community] unable to persist saved IDs', err);
    }
}

function normalizeSubmissionId(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    return null;
}

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
    return `"${resolveMessage(item)}"\n\nمن مشروع أجر لا ينقطع\n${siteUrl}`;
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
        trendingBadge.textContent = 'رائج الآن';
        top.appendChild(trendingBadge);
    }

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'save-btn btn btn-ghost';
    const submissionId = normalizeSubmissionId(item.id);
    if (submissionId) {
        saveButton.dataset.saveId = submissionId;
    }

    const isSaved = submissionId ? state.savedIds.has(submissionId) : false;
    saveButton.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
    saveButton.setAttribute('aria-label', isSaved ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
    saveButton.textContent = isSaved ? '♥' : '♡';
    top.appendChild(saveButton);

    return top;
}

function createCard(item, avgPostCount = 0) {
    const card = document.createElement('article');
    card.className = 'submission-card card card-soft card-enter';
    card.dataset.submissionId = String(item.id);
    card.id = `submission-${item.id}`;
    card.tabIndex = 0;

    card.appendChild(createCardTop(item, avgPostCount));

    const message = document.createElement('p');
    message.className = 'submission-message';
    message.dataset.expanded = 'false';
    message.textContent = `"${resolveMessage(item)}"`;
    card.appendChild(message);

    const meta = document.createElement('div');
    meta.className = 'submission-meta';

    const timestamp = document.createElement('time');
    timestamp.dateTime = item.created_at;
    timestamp.textContent = formatDate(item.created_at);
    meta.appendChild(timestamp);

    const shares = document.createElement('p');
    shares.className = 'shares';
    shares.dataset.shareCountId = String(item.id);
    shares.textContent = `تمت المشاركة ${formatNumber(item.post_count)} مرة`;
    meta.appendChild(shares);

    card.appendChild(meta);

    // Group action buttons horizontally for a premium layout
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const shareButton = document.createElement('button');
    shareButton.className = 'share-btn btn btn-ghost';
    shareButton.type = 'button';
    shareButton.dataset.shareId = String(item.id);
    shareButton.textContent = 'شارك الذكر';
    actions.appendChild(shareButton);

    const posterButton = document.createElement('a');
    posterButton.className = 'poster-btn btn';
    posterButton.href = `/poster?text=${encodeURIComponent(resolveMessage(item))}&type=${encodeURIComponent(item.content_type || 'dhikr')}`;
    posterButton.innerHTML = 'تصميم بطاقة';
    posterButton.title = 'تحويل هذا الذكر إلى لوحة فنية ومشاركته كصدقة جارية';
    actions.appendChild(posterButton);

    card.appendChild(actions);

    return card;
}

function createInviteCard() {
    const card = document.createElement('article');
    card.className = 'submission-card card card-soft card-enter';

    const top = document.createElement('div');
    top.className = 'submission-card__top';

    const badge = document.createElement('span');
    badge.className = `content-badge badge-${COMMUNITY_INVITE_CARD.contentType}`;
    badge.textContent = badgeLabels[COMMUNITY_INVITE_CARD.contentType] || COMMUNITY_INVITE_CARD.contentType;
    top.appendChild(badge);

    card.appendChild(top);

    const message = document.createElement('p');
    message.className = 'submission-message';
    message.textContent = COMMUNITY_INVITE_CARD.message;
    card.appendChild(message);

    const addButton = document.createElement('a');
    addButton.className = 'btn btn-primary';
    addButton.href = COMMUNITY_INVITE_CARD.formUrl;
    addButton.dataset.inviteAction = 'add-dhikr';
    addButton.textContent = COMMUNITY_INVITE_CARD.ctaText;
    card.appendChild(addButton);

    return card;
}

function ensureMessageRegionId(message, fallbackId) {
    if (message.id) return message.id;

    const regionId = `submission-content-${fallbackId}`;
    message.id = regionId;
    return regionId;
}

function measureCollapsedHeight(message) {
    return message.clientHeight;
}

function setupExpandableCards(container) {
    const cards = container.querySelectorAll('.submission-card[data-submission-id]');

    cards.forEach((card) => {
        const message = card.querySelector('.submission-message');
        if (!message) return;

        const fallbackId = card.dataset.submissionId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const regionId = ensureMessageRegionId(message, fallbackId);
        const collapsedHeight = measureCollapsedHeight(message);
        const isOverflowing = message.scrollHeight > collapsedHeight + 1;

        message.style.setProperty('--collapsed-height', `${collapsedHeight}px`);

        const existingToggle = card.querySelector('[data-expand-toggle]');
        if (!isOverflowing) {
            if (existingToggle) existingToggle.remove();
            message.classList.remove('is-expandable', 'is-expanded');
            message.dataset.expanded = 'false';
            message.style.maxHeight = `${collapsedHeight}px`;
            return;
        }

        message.classList.add('is-expandable');

        if (existingToggle) return;

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'submission-expand-btn';
        toggleButton.dataset.expandToggle = 'true';
        toggleButton.setAttribute('aria-controls', regionId);
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.textContent = 'عرض المزيد';
        card.insertBefore(toggleButton, card.querySelector('.submission-meta'));
    });
}

function toggleCardExpansion(card, button) {
    const message = card.querySelector('.submission-message');
    if (!message) return;

    const collapsedHeight = Number.parseFloat(message.style.getPropertyValue('--collapsed-height')) || message.clientHeight;
    const isExpanded = message.dataset.expanded === 'true';

    const previousTop = card.getBoundingClientRect().top;

    message.style.maxHeight = `${message.scrollHeight}px`;
    void message.offsetHeight;

    if (isExpanded) {
        message.dataset.expanded = 'false';
        card.dataset.expanded = 'false';
        message.classList.remove('is-expanded');
        button.setAttribute('aria-expanded', 'false');
        button.textContent = 'عرض المزيد';
        message.style.maxHeight = `${collapsedHeight}px`;
    } else {
        message.dataset.expanded = 'true';
        card.dataset.expanded = 'true';
        message.classList.add('is-expanded');
        button.setAttribute('aria-expanded', 'true');
        button.textContent = 'عرض أقل';
        message.style.maxHeight = `${message.scrollHeight}px`;
    }

    const onTransitionEnd = (event) => {
        if (event.propertyName !== 'max-height') return;

        if (message.dataset.expanded === 'true') {
            message.style.maxHeight = 'none';
        } else {
            message.style.maxHeight = `${collapsedHeight}px`;
            const nextTop = card.getBoundingClientRect().top;
            const delta = nextTop - previousTop;
            if (Math.abs(delta) > 1) {
                window.scrollBy({ top: delta, behavior: 'auto' });
            }
        }

        message.removeEventListener('transitionend', onTransitionEnd);
    };

    message.addEventListener('transitionend', onTransitionEnd);
}

function getSubmissionIdFromHash() {
    const rawHash = window.location.hash || '';
    const match = rawHash.match(/^#submission-(.+)$/);
    if (!match?.[1]) return null;
    return normalizeSubmissionId(decodeURIComponent(match[1]));
}

function revealHashTargetIfNeeded() {
    if (!state.hashTargetSubmissionId || state.hasHandledHashTarget) return;

    const targetCard = document.getElementById(`submission-${state.hashTargetSubmissionId}`);
    if (!targetCard) return;

    requestAnimationFrame(() => {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const expandButton = targetCard.querySelector('[data-expand-toggle]');
        const isExpanded = expandButton?.getAttribute('aria-expanded') === 'true';

        if (expandButton && !isExpanded) {
            toggleCardExpansion(targetCard, expandButton);
        }
    });

    state.hasHandledHashTarget = true;
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

    elements.shareToast.textContent = 'تم إضافة ذكرك للمراجعة';
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
    // Single source lib/share.js when loaded; local fallback otherwise.
    if (globalThis.ShareLib) {
        await globalThis.ShareLib.copyText(text);
        return;
    }

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
        const response = await timedFetch(SHARE_TRACK_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ platform, submissionId }),
        });

        if (!response.ok) return false;
        const result = await response.json();
        return result?.tracked === true;
    } catch {
        // lightweight tracking only
        return false;
    }
}

function incrementLocalShareMetrics(submissionId) {
    const normalizedId = normalizeSubmissionId(submissionId);
    if (!normalizedId) return;

    const item = state.submissionsById.get(normalizedId);
    if (!item) return;

    item.post_count = Math.max(Number(item.post_count) || 0, 0) + 1;

    document.querySelectorAll(`[data-share-count-id="${CSS.escape(normalizedId)}"]`).forEach((element) => {
        element.textContent = `تمت المشاركة ${formatNumber(item.post_count)} مرة`;
    });

    state.stats.totalPostCount = Math.max(Number(state.stats.totalPostCount) || 0, 0) + 1;
    if (elements.totalSharesCount) {
        elements.totalSharesCount.textContent = `تم نشر الأذكار ${formatNumber(state.stats.totalPostCount)} مرة`;
    }

    // Trigger dynamic Tree of Goodness growth + shooting particle effect
    if (window.GlobalTreeOfGoodness) {
        window.GlobalTreeOfGoodness.triggerShareEffect(window.activeShareClickEvent);
    }
}

async function shareSubmission(item) {
    const preferredPlatform = 'whatsapp';
    const shareText = getShareMessage(item, preferredPlatform);

    try {
        if (navigator.share) {
            await navigator.share({ text: shareText, url: getShareTargetUrl(preferredPlatform) });
            const tracked = await trackShare('native', item.id);
            if (tracked) {
                incrementLocalShareMetrics(item.id);
            }
            return;
        }

        await copyToClipboard(shareText);
        const tracked = await trackShare(preferredPlatform, item.id);
        if (tracked) {
            incrementLocalShareMetrics(item.id);
        }
        showToast();
    } catch (err) {
        if (err?.name !== 'AbortError') {
            try {
                await copyToClipboard(shareText);
                const tracked = await trackShare(preferredPlatform, item.id);
                if (tracked) {
                    incrementLocalShareMetrics(item.id);
                }
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
        await timedFetch(VIEW_ENDPOINT, {
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

function buildCards(submissions, avgPostCount, shouldInjectInvite = false) {
    const fragment = document.createDocumentFragment();
    const inviteIndex = submissions.length <= 1 ? submissions.length : Math.floor(submissions.length / 2);

    submissions.forEach((item, index) => {
        if (shouldInjectInvite && index === inviteIndex) {
            fragment.appendChild(createInviteCard());
        }
        fragment.appendChild(createCard(item, avgPostCount));
    });

    if (shouldInjectInvite && inviteIndex === submissions.length) {
        fragment.appendChild(createInviteCard());
    }

    return fragment;
}

function buildSavedCard(item) {
    const card = document.createElement('article');
    card.className = 'submission-card card card-soft';

    const top = document.createElement('div');
    top.className = 'submission-card__top';
    const badge = document.createElement('span');
    badge.className = `content-badge badge-${item.content_type}`;
    badge.textContent = badgeLabels[item.content_type] || item.content_type;
    top.appendChild(badge);
    card.appendChild(top);

    const message = document.createElement('p');
    message.className = 'submission-message';
    message.textContent = `"${resolveMessage(item)}"`;
    card.appendChild(message);

    return card;
}

function renderSavedItems() {
    if (!elements.savedItems || !elements.savedEmptyMessage || !elements.savedTasteMessage) return;

    const savedItems = Array.from(state.savedIds)
        .map((id) => state.submissionsById.get(id))
        .filter(Boolean)
        .slice(0, 10);

    elements.savedItems.innerHTML = '';
    savedItems.forEach((item) => {
        elements.savedItems.appendChild(buildSavedCard(item));
    });

    elements.savedEmptyMessage.hidden = savedItems.length > 0;
    elements.savedTasteMessage.hidden = state.savedIds.size < 3;
}

function syncSaveButtons() {
    document.querySelectorAll('[data-save-id]').forEach((button) => {
        const submissionId = normalizeSubmissionId(button.dataset.saveId);
        if (!submissionId) return;
        const isSaved = state.savedIds.has(submissionId);
        button.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
        button.setAttribute('aria-label', isSaved ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
        button.textContent = isSaved ? '♥' : '♡';
    });
}

function toggleSaved(submissionId) {
    const normalizedId = normalizeSubmissionId(submissionId);
    if (!normalizedId) return;

    if (state.savedIds.has(normalizedId)) {
        state.savedIds.delete(normalizedId);
    } else {
        state.savedIds = new Set([normalizedId, ...Array.from(state.savedIds)]);
    }

    persistSavedIds();
    syncSaveButtons();
    renderSavedItems();
}

function applyFocusMode() {
    const active = state.focusMode;
    document.body.classList.toggle('community-focus-mode', active);
    if (elements.focusModeToggle) {
        elements.focusModeToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
        elements.focusModeToggle.textContent = active ? 'إيقاف الوضع الهادئ' : 'وضع هادئ';
    }
}

function initializeFocusMode() {
    state.focusMode = safeStorageGet(STORAGE_KEYS.focusMode) === '1';
    applyFocusMode();
}

function initializeLastFilter() {
    const savedType = safeStorageGet(STORAGE_KEYS.lastFilter);
    const allowed = ['all', 'dhikr', 'dua', 'ayah', 'hadith', 'benefit'];
    if (allowed.includes(savedType)) {
        state.type = savedType;
        setActiveTab(state.type);
    }
}

function initializeReturnMemory() {
    const today = getTodayKey();
    const previousVisit = safeStorageGet(STORAGE_KEYS.lastVisitDate);

    if (previousVisit === today && elements.returnMemory) {
        elements.returnMemory.hidden = false;
    }

    safeStorageSet(STORAGE_KEYS.lastVisitDate, today);
}

async function fetchSubmissions() {
    // Ignore stale responses when filters/pages change mid-flight.
    const seq = ++fetchSubmissions.seq;
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
        const response = await timedFetch(`${API_ENDPOINT}?${query.toString()}`, {
            headers: {
                'x-ref-source': state.refSource,
            },
        });

        if (!response.ok) {
            throw new Error('Request failed');
        }

        const result = await response.json();

        if (seq !== fetchSubmissions.seq) return; // superseded

        if (!result.success) {
            throw new Error(result.message || 'Unexpected API response');
        }


        renderResponse(result);
    } catch (err) {
        if (seq !== fetchSubmissions.seq) return; // superseded, keep newer state
        elements.stateMessage.textContent = 'تعذر تحميل المشاركات حاليًا. حاول مرة أخرى لاحقًا.';
        elements.pagination.hidden = true;
    }
}
fetchSubmissions.seq = 0;

function renderStats(stats = {}, pagination = {}) {
    const totalApproved = stats.totalApproved || pagination.total || 0;
    const totalShares = stats.totalPostCount || 0;

    state.stats.totalApproved = totalApproved;
    state.stats.totalPostCount = totalShares;

    if (elements.approvedCount) {
        elements.approvedCount.textContent = `${formatNumber(totalApproved)} مشاركة معتمدة`;
    }
    if (elements.totalSharesCount) {
        elements.totalSharesCount.textContent = `تم نشر الأذكار ${formatNumber(totalShares)} مرة`;
    }
    if (elements.mobileApprovedCount) {
        elements.mobileApprovedCount.textContent = `${formatNumber(totalApproved)} مشاركة`;
    }
    if (elements.mobileStatsBar) {
        elements.mobileStatsBar.hidden = false;
    }

    // Sync stats directly with the Tree of Goodness engine
    if (window.GlobalTreeOfGoodness) {
        window.GlobalTreeOfGoodness.updateStats(totalApproved, totalShares);
    }
}

function cacheSubmissions(submissions = []) {
    submissions.forEach((item) => {
        const submissionId = normalizeSubmissionId(item.id);
        if (!submissionId) return;
        state.submissionsById.set(submissionId, item);
    });
}

function renderResponse(result) {
    const { submissions, pagination, stats } = result;
    const shouldInjectInvite = state.type === 'all' || state.type === COMMUNITY_INVITE_CARD.contentType;
    const visibleSubmissions = Array.isArray(submissions) ? submissions : [];

    const avgPostCount = Number(stats?.averagePostCount) || 0;
    state.totalPages = Math.max(Number(pagination?.totalPages) || 1, 1);
    state.total = Number(pagination?.total) || 0;
    state.page = Math.min(Math.max(Number(pagination?.page) || state.page, 1), state.totalPages);

    cacheSubmissions(visibleSubmissions);
    renderStats(stats, pagination);

    if (!visibleSubmissions.length && !shouldInjectInvite) {
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
    elements.submissionsContainer.appendChild(buildCards(visibleSubmissions, avgPostCount, shouldInjectInvite));
    setupExpandableCards(elements.submissionsContainer);
    revealHashTargetIfNeeded();
    renderSavedItems();

    elements.pagination.hidden = false;
    elements.pageInfo.textContent = `صفحة ${state.page} من ${state.totalPages}`;
    elements.prevPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= state.totalPages;
}

function setActiveTab(type) {
    document.querySelectorAll('#filterTabs .tab').forEach((button) => {
        const isActive = button.dataset.type === type;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

function focusTabByOffset(current, offset) {
    const tabs = Array.from(document.querySelectorAll('#filterTabs .tab'));
    const index = tabs.indexOf(current);
    if (index === -1 || tabs.length === 0) return;
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    if (next) next.focus();
}

elements.filterTabs.addEventListener('keydown', (event) => {
    const button = event.target.closest('.tab');
    if (!button) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        // RTL: ArrowLeft moves forward, ArrowRight moves backward
        const isRTL = document.documentElement.dir !== 'ltr';
        const forward = event.key === 'ArrowLeft' ? 1 : -1;
        focusTabByOffset(button, isRTL ? forward : -forward);
    } else if (event.key === 'Home') {
        event.preventDefault();
        const first = document.querySelector('#filterTabs .tab');
        if (first) first.focus();
    } else if (event.key === 'End') {
        event.preventDefault();
        const tabs = document.querySelectorAll('#filterTabs .tab');
        const last = tabs[tabs.length - 1];
        if (last) last.focus();
    }
});

elements.filterTabs.addEventListener('click', (event) => {
    const button = event.target.closest('.tab');
    if (!button) return;

    state.type = button.dataset.type;
    safeStorageSet(STORAGE_KEYS.lastFilter, state.type);
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
    const inviteButton = event.target.closest('[data-invite-action="add-dhikr"]');
    if (inviteButton) {
        event.preventDefault();
        window.location.href = COMMUNITY_INVITE_CARD.formUrl;
        return;
    }

    const saveButton = event.target.closest('[data-save-id]');
    if (saveButton) {
        event.preventDefault();
        event.stopPropagation();
        toggleSaved(saveButton.dataset.saveId);
        return;
    }

    const shareButton = event.target.closest('[data-share-id]');
    if (shareButton) {
        event.preventDefault();
        event.stopPropagation();
        const submissionId = normalizeSubmissionId(shareButton.dataset.shareId);
        if (!submissionId) return;
        const selected = state.submissionsById.get(submissionId);
        if (!selected) return;

        // Temporarily store click coordinate context for beautiful shooting star physics
        window.activeShareClickEvent = event;
        await shareSubmission(selected);
        window.activeShareClickEvent = null;
        return;
    }

    const expandButton = event.target.closest('[data-expand-toggle]');
    if (expandButton) {
        event.preventDefault();
        event.stopPropagation();
        const card = expandButton.closest('.submission-card[data-submission-id]');
        if (!card) return;
        toggleCardExpansion(card, expandButton);
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

if (elements.focusModeToggle) {
    elements.focusModeToggle.addEventListener('click', () => {
        state.focusMode = !state.focusMode;
        safeStorageSet(STORAGE_KEYS.focusMode, state.focusMode ? '1' : '0');
        applyFocusMode();
    });
}

// --- Suggestions / Feedback Form Handler ---
function checkFeedbackRateLimit() {
    const now = Date.now();
    const lastSubmit = Number(safeStorageGet('ajr_last_feedback_time') || '0');
    if (now - lastSubmit < 60_000) {
        const remaining = Math.ceil((60_000 - (now - lastSubmit)) / 1000);
        return { limited: true, reason: `من فضلك انتظر ${formatNumber(remaining)} ثانية قبل إرسال مقترح آخر.` };
    }
    
    const today = getTodayKey();
    const storedDay = safeStorageGet('ajr_feedback_date');
    let dailyCount = Number(safeStorageGet('ajr_feedback_count') || '0');
    if (storedDay !== today) {
        dailyCount = 0;
    }
    
    if (dailyCount >= 3) {
        return { limited: true, reason: 'لقد وصلت للحد الأقصى للمقترحات اليوم (٣ مقترحات). شكر الله سعيكم!' };
    }
    
    return { limited: false };
}

function recordFeedbackSubmission() {
    const today = getTodayKey();
    const storedDay = safeStorageGet('ajr_feedback_date');
    let dailyCount = Number(safeStorageGet('ajr_feedback_count') || '0');
    if (storedDay !== today) {
        dailyCount = 0;
    }
    
    safeStorageSet('ajr_last_feedback_time', String(Date.now()));
    safeStorageSet('ajr_feedback_date', today);
    safeStorageSet('ajr_feedback_count', String(dailyCount + 1));
}

function setupFeedbackForm() {
    const form = document.getElementById('feedbackForm');
    const successMsg = document.getElementById('feedbackSuccess');
    const errorText = document.getElementById('feedbackMessageError');
    const submitBtn = document.getElementById('feedbackSubmitBtn');
    
    if (!form || !successMsg || !errorText || !submitBtn) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Dynamic spiritual start toast
        const spiritualStarts = [
            'جاري إرسال مقترحكم... نسأل الله القبول والتوفيق',
            'في طريق الإرسال... شكر الله سعيكم الطيب',
            'يرسل الآن... نسأل الله النفع واليسر'
        ];
        const randomStart = spiritualStarts[Math.floor(Math.random() * spiritualStarts.length)];
        
        // Reset validation error state
        errorText.hidden = true;
        
        const messageVal = form.message.value.trim();
        const nameVal = form.name.value.trim();
        const emailVal = form.email.value.trim();
        
        if (messageVal.length < 10) {
            errorText.hidden = false;
            elements.shareToast.textContent = 'فضلاً، اكتب مقترحًا نافعًا لا يقل عن ١٠ أحرف لتعم الفائدة.';
            showToast();
            return;
        }
        
        // Rate limiting check
        const limitCheck = checkFeedbackRateLimit();
        if (limitCheck.limited) {
            elements.shareToast.textContent = limitCheck.reason;
            showToast();
            return;
        }
        
        submitBtn.disabled = true;
        elements.shareToast.textContent = randomStart;
        showToast();
        
        try {
            const response = await timedFetch('/.netlify/functions/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: nameVal || 'فاعل خير',
                    email: emailVal || null,
                    message: messageVal
                }),
            });
            
            if (!response.ok) {
                throw new Error('Server error');
            }
            
            recordFeedbackSubmission();
            
            // Swap display to success message
            form.hidden = true;
            successMsg.hidden = false;
            
            elements.shareToast.textContent = 'تم استلام مقترحكم بنجاح! شكر الله سعيكم';
            showToast();
        } catch (err) {
            console.error('[Feedback] failed to send', err);
            submitBtn.disabled = false;
            
            elements.shareToast.textContent = 'حدث خطأ غير متوقع أثناء الإرسال، نسأل الله التيسير.';
            showToast();
        }
    });
}

state.refSource = initializeRefSource();
state.savedIds = loadSavedIds();
state.hashTargetSubmissionId = getSubmissionIdFromHash();
initializeFocusMode();
initializeLastFilter();
initializeReturnMemory();
setupFeedbackForm();
showSubmissionReviewToastIfNeeded();
fetchSubmissions();
