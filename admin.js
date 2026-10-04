// ═══════════════════════════════════════════════════════════════════════════
// أجر لا ينقطع - Admin Panel Script
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════
    // Single source: lib/config.js (loaded before this script)
    const API_BASE = window.AppConfig.API_BASE;

    // Auth security settings
    const AUTH_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_BASE_MS = 2000; // starts at 2s, doubles each lockout

    // Memory-only auth state (never persisted to disk)
    let adminKey = '';
    let authExpiresAt = 0;
    let failedAttempts = 0;
    let lockoutUntil = 0;

    // Restore session from sessionStorage (token only, not the key)
    const sessionToken = sessionStorage.getItem('adminSession');
    if (sessionToken) {
        try {
            const parsed = JSON.parse(sessionToken);
            if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
                // Session still valid — key must be re-entered
                // We only keep the expiry to show remaining time
                authExpiresAt = parsed.expiresAt;
            } else {
                sessionStorage.removeItem('adminSession');
            }
        } catch {
            sessionStorage.removeItem('adminSession');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DOM Elements
    // ═══════════════════════════════════════════════════════════════════
    const loginSection = document.getElementById('login-section');
    const adminSection = document.getElementById('admin-section');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const apiKeyInput = document.getElementById('api-key');
    const submissionsList = document.getElementById('submissions-list');
    const loadingEl = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const notification = document.getElementById('notification');
    
    // Memory Updates Tab Elements
    const memoryUpdatesTab = document.getElementById('memory-updates-tab');
    const memoryUpdatesList = document.getElementById('memory-updates-list');
    const memoryUpdatesLoadingEl = document.getElementById('memory-updates-loading');
    const memoryUpdatesEmptyState = document.getElementById('memory-updates-empty-state');
    const memoryUpdatesNotification = document.getElementById('memory-updates-notification');

    // ═══════════════════════════════════════════════════════════════════
    // API Helpers
    // ═══════════════════════════════════════════════════════════════════
    // Timeout-bounded fetch (lib/fetch-utils.js when loaded, see #145).
    function timedFetch(url, options) {
        if (globalThis.FetchUtils) return globalThis.FetchUtils.fetchWithTimeout(url, options);
        return fetch(url, options);
    }

    async function apiRequest(endpoint, method = 'GET', body = null) {
        if (!adminKey) {
            logout();
            throw new Error('Not authenticated');
        }
        if (isSessionExpired()) {
            logout();
            throw new Error('Session expired');
        }
        refreshSessionTimer();

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Key': adminKey
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await timedFetch(`${API_BASE}${endpoint}`, options);
        return response.json();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Authentication
    // ═══════════════════════════════════════════════════════════════════

    function isLockedOut() {
        if (Date.now() < lockoutUntil) {
            const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            return remaining;
        }
        lockoutUntil = 0;
        return 0;
    }

    function recordFailedAttempt() {
        failedAttempts++;
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            const lockoutMs = LOCKOUT_BASE_MS * Math.pow(2, failedAttempts - MAX_FAILED_ATTEMPTS);
            lockoutUntil = Date.now() + Math.min(lockoutMs, 300000); // max 5 min
            return Math.ceil(lockoutUntil - Date.now() / 1000);
        }
        return 0;
    }

    function recordSuccessfulAuth() {
        failedAttempts = 0;
        lockoutUntil = 0;
        authExpiresAt = Date.now() + AUTH_TIMEOUT_MS;
        sessionStorage.setItem('adminSession', JSON.stringify({ expiresAt: authExpiresAt }));
        // NOTE: the key itself is NEVER persisted (memory only). Any injected
        // script could otherwise read it from storage and own the admin API.
    }

    function isSessionExpired() {
        return authExpiresAt > 0 && Date.now() >= authExpiresAt;
    }

    function refreshSessionTimer() {
        if (adminKey && authExpiresAt) {
            authExpiresAt = Date.now() + AUTH_TIMEOUT_MS;
            sessionStorage.setItem('adminSession', JSON.stringify({ expiresAt: authExpiresAt }));
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const lockedSeconds = isLockedOut();
        if (lockedSeconds > 0) {
            showLoginError(`محاولات كثيرة جدًا. انتظر ${lockedSeconds} ثانية.`);
            return;
        }

        const attemptedKey = apiKeyInput.value.trim();
        if (!attemptedKey) {
            showLoginError('يرجى إدخال مفتاح API');
            return;
        }

        adminKey = attemptedKey;

        try {
            const result = await apiRequest('/api/admin/stats');

            if (result.success) {
                recordSuccessfulAuth();
                showAdminPanel();
            } else {
                recordFailedAttempt();
                const remaining = isLockedOut();
                if (remaining > 0) {
                    showLoginError(`مفتاح غير صحيح. مقفل لمدة ${remaining} ثانية.`);
                } else {
                    showLoginError('مفتاح API غير صحيح');
                }
                adminKey = '';
            }
        } catch (error) {
            showLoginError('فشل الاتصال بالخادم');
            adminKey = '';
        }
    });

    function showLoginError(message) {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
    }

    // Toggle password visibility
    const togglePassword = document.getElementById('toggle-password');
    togglePassword.addEventListener('click', () => {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
    });

    function logout() {
        adminKey = '';
        authExpiresAt = 0;
        failedAttempts = 0;
        lockoutUntil = 0;
        sessionStorage.removeItem('adminSession');
        loginSection.classList.remove('hidden');
        adminSection.classList.add('hidden');
        apiKeyInput.value = '';
    }

    function showAdminPanel() {
        loginSection.classList.add('hidden');
        adminSection.classList.remove('hidden');
        loadStats();
        loadPending();
        loadFeedback(); // Initial load to update the badge
    }

    // ═══════════════════════════════════════════════════════════════════
    // Load Data
    // ═══════════════════════════════════════════════════════════════════
    async function loadStats() {
        try {
            const result = await apiRequest('/api/admin/stats');
            if (result.success) {
                document.getElementById('pending-count').textContent = result.stats.pending;
                document.getElementById('approved-count').textContent = result.stats.approved;
                document.getElementById('rejected-count').textContent = result.stats.rejected;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    let submissionsPage = 1;
    let memoriesPage = 1;

    async function loadPending(page = 1) {
        // Refresh buttons pass the click Event — only honor real numbers
        submissionsPage = typeof page === 'number' && page > 0 ? Math.floor(page) : 1;
        loadingEl.classList.remove('hidden');
        submissionsList.classList.add('hidden');
        emptyState.classList.add('hidden');

        try {
            const result = await apiRequest(`/api/admin/pending?page=${submissionsPage}`);

            loadingEl.classList.add('hidden');

            if (result.success && result.data.length > 0) {
                renderSubmissions(result.data);
                submissionsList.classList.remove('hidden');
                renderPager('submissions', result);
            } else if (submissionsPage > 1) {
                // Page emptied by moderation — step back
                loadPending(submissionsPage - 1);
            } else {
                emptyState.classList.remove('hidden');
                renderPager('submissions', null);
            }
        } catch (error) {
            loadingEl.classList.add('hidden');
            showNotification('فشل تحميل البيانات', 'error');
        }
    }

    function renderPager(prefix, result) {
        const pager = document.getElementById(`${prefix}-pager`);
        const prev = document.getElementById(`${prefix}-prev`);
        const next = document.getElementById(`${prefix}-next`);
        const info = document.getElementById(`${prefix}-page-info`);
        if (!pager || !prev || !next || !info) return;

        const totalPages = result && result.totalPages > 1 ? result.totalPages : 1;
        const page = Math.min(result && result.page > 0 ? result.page : 1, totalPages);
        const total = result && typeof result.count === 'number' ? result.count : 0;

        pager.hidden = totalPages <= 1;
        prev.disabled = page <= 1;
        next.disabled = page >= totalPages;
        info.textContent = `صفحة ${page} من ${totalPages} (الإجمالي ${total})`;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Render Submissions
    // ═══════════════════════════════════════════════════════════════════
    const CONTENT_TYPE_LABELS = {
        dhikr: 'ذكر',
        dua: 'دعاء',
        ayah: 'آية قرآنية',
        hadith: 'حديث نبوي',
        benefit: 'فائدة',
    };

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Attribute-context escaping (single source lib/escape.js when loaded).
    // value="..." interpolation with escapeHtml alone allows quote-breakout,
    // and these values come from user-submitted proposals.
    const EscapeAttrLib = globalThis.EscapeLib || {
        escapeAttr(value) {
            return String(value === null || value === undefined ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },
    };

    function escapeAttr(value) {
        return EscapeAttrLib.escapeAttr(value);
    }

    /**
     * Render a user-submitted URL as a link only when its scheme is safe
     * (http/https). Anything else (javascript:, data:, ...) renders as
     * inert text so a stored proposal can never execute in an admin
     * session — where sessionStorage used to hold the admin key (#131).
     */
    function safeReviewLink(url, label) {
        const text = escapeHtml(label || url);
        if (EscapeAttrLib.isSafeHttpUrl
            ? EscapeAttrLib.isSafeHttpUrl(url, { allowRelative: true, allowDataImage: false })
            : /^https?:/i.test(String(url || '').trim())) {
            return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return `<span>${text}</span>`;
    }

    function renderSubmissions(submissions) {
        submissionsList.innerHTML = submissions.map(sub => `
            <div class="submission-card" data-id="${escapeHtml(String(sub.id))}">
                <div class="submission-meta">
                    <span class="content-type-badge">${CONTENT_TYPE_LABELS[sub.content_type] || escapeHtml(sub.content_type)}</span>
                    <span>${formatDate(sub.created_at)}</span>
                </div>
                
                <div class="original-message-label">المحتوى الأصلي (للقراءة فقط):</div>
                <div class="original-message">${escapeHtml(sub.message)}</div>
                
                <div class="correction-label">التصحيح (اختياري - للأخطاء الإملائية فقط):</div>
                <textarea 
                    class="correction-textarea" 
                    id="correction-${escapeHtml(String(sub.id))}"
                    placeholder="اترك فارغًا للموافقة على النص الأصلي..."
                >${escapeHtml(sub.corrected_message || '')}</textarea>
                
                <div class="actions">
                    <button class="btn btn-success btn-sm" data-action="approve" data-id="${escapeHtml(String(sub.id))}">
                        ✓ موافقة
                    </button>
                    <button class="btn btn-danger btn-sm" data-action="reject" data-id="${escapeHtml(String(sub.id))}">
                        ✗ رفض
                    </button>
                </div>
            </div>
        `).join('');
    }

    function handleCardAction(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'approve') approve(id);
        if (action === 'reject') reject(id);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Actions
    // ═══════════════════════════════════════════════════════════════════
    async function approve(id) {
        const correction = document.getElementById(`correction-${id}`).value.trim();

        const body = { id };
        if (correction) {
            body.corrected_message = correction;
        }

        try {
            const result = await apiRequest('/api/admin/approve', 'POST', body);

            if (result.success) {
                showNotification('تمت الموافقة على المشاركة', 'success');
                loadStats();
                loadPending(submissionsPage);
            } else {
                showNotification(result.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            showNotification('فشل الاتصال بالخادم', 'error');
        }
    }

    async function reject(id) {
        if (!confirm('هل أنت متأكد من رفض هذه المشاركة؟')) {
            return;
        }

        try {
            const result = await apiRequest('/api/admin/reject', 'POST', { id });

            if (result.success) {
                showNotification('تم رفض المشاركة', 'success');
                loadStats();
                loadPending(submissionsPage);
            } else {
                showNotification(result.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            showNotification('فشل الاتصال بالخادم', 'error');
        }
    }

    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = type === 'error' ? 'error-message' : 'success-message';
        notification.classList.remove('hidden');

        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Memories Moderation (صفحات الذكرى)
    // ═══════════════════════════════════════════════════════════════════
    const memoriesList = document.getElementById('memories-list');
    const memoryLoadingEl = document.getElementById('memory-loading');
    const memoryEmptyState = document.getElementById('memory-empty-state');
    const memoryNotification = document.getElementById('memory-notification');

    // Tab Switching
    function switchTab(tabName) {
        const submissionsTab = document.getElementById('submissions-tab');
        const memoriesTab = document.getElementById('memories-tab');
        const feedbackTab = document.getElementById('feedback-tab');
        const tabSubmissions = document.getElementById('tab-submissions');
        const tabMemories = document.getElementById('tab-memories');
        const tabFeedback = document.getElementById('tab-feedback');
        const tabMemoryUpdates = document.getElementById('tab-memory-updates');

        // Hide all tabs
        submissionsTab.classList.add('hidden');
        memoriesTab.classList.add('hidden');
        if (feedbackTab) feedbackTab.classList.add('hidden');
        if (memoryUpdatesTab) memoryUpdatesTab.classList.add('hidden');
        tabSubmissions.className = 'btn btn-ghost btn-sm admin-tab';
        tabMemories.className = 'btn btn-ghost btn-sm admin-tab';
        if (tabFeedback) tabFeedback.className = 'btn btn-ghost btn-sm admin-tab';
        if (tabMemoryUpdates) tabMemoryUpdates.className = 'btn btn-ghost btn-sm admin-tab';

        if (tabName === 'submissions') {
            submissionsTab.classList.remove('hidden');
            tabSubmissions.className = 'btn btn-primary btn-sm admin-tab active';
        } else if (tabName === 'memories') {
            memoriesTab.classList.remove('hidden');
            tabMemories.className = 'btn btn-primary btn-sm admin-tab active';
            loadPendingMemories();
        } else if (tabName === 'feedback') {
            if (feedbackTab) feedbackTab.classList.remove('hidden');
            if (tabFeedback) tabFeedback.className = 'btn btn-primary btn-sm admin-tab active';
            loadFeedback();
        } else if (tabName === 'memory-updates') {
            if (memoryUpdatesTab) memoryUpdatesTab.classList.remove('hidden');
            if (tabMemoryUpdates) tabMemoryUpdates.className = 'btn btn-primary btn-sm admin-tab active';
            loadPendingMemoryUpdates();
        }
    }

    async function loadPendingMemories(page = 1) {
        // Refresh buttons pass the click Event — only honor real numbers
        memoriesPage = typeof page === 'number' && page > 0 ? Math.floor(page) : 1;
        memoryLoadingEl.classList.remove('hidden');
        memoriesList.classList.add('hidden');
        memoryEmptyState.classList.add('hidden');

        try {
            const result = await apiRequest(`/api/admin/memory/pending?page=${memoriesPage}`);

            memoryLoadingEl.classList.add('hidden');

            if (result.success && result.data.length > 0) {
                renderMemories(result.data);
                memoriesList.classList.remove('hidden');
                document.getElementById('memory-pending-count').textContent =
                    typeof result.count === 'number' ? result.count : result.data.length;
                renderPager('memories', result);
            } else if (memoriesPage > 1) {
                // Page emptied by moderation — step back
                loadPendingMemories(memoriesPage - 1);
            } else {
                memoryEmptyState.classList.remove('hidden');
                document.getElementById('memory-pending-count').textContent = '0';
                renderPager('memories', null);
            }
        } catch (error) {
            memoryLoadingEl.classList.add('hidden');
            showMemoryNotification('فشل تحميل البيانات', 'error');
        }
    }

    function renderMemories(memories) {
        memoriesList.innerHTML = memories.map(mem => {
            // Helper to securely format links
            let linksHtml = '';
            if (Array.isArray(mem.external_links) && mem.external_links.length > 0) {
                linksHtml = '<div class="admin-links-box"><strong>روابط الصدقة:</strong><ul>' +
                    mem.external_links.map(l =>
                        `<li>${safeReviewLink(l.url, l.title || l.url)}</li>`
                    ).join('') +
                    '</ul></div>';
            }

            return `
                <div class="submission-card" data-memory-id="${escapeHtml(String(mem.id))}">
                    <div class="submission-meta">
                        <span class="content-type-badge">صدقة جارية</span>
                        <span>${formatDate(mem.created_at)}</span>
                    </div>
                    
                    <div class="original-message-label">اسم المتوفى:</div>
                    <div class="original-message admin-strong">${escapeHtml(mem.deceased_name)}</div>
                    
                    ${mem.relation ? `<div class="admin-relation">صلة القرابة: ${escapeHtml(mem.relation)}</div>` : ''}
                    
                    ${mem.biography ? `
                        <div class="original-message-label admin-label-spaced">عن المتوفى (نبذة):</div>
                        <div class="original-message">${escapeHtml(mem.biography)}</div>
                    ` : ''}

                    ${mem.good_traits ? `
                        <div class="original-message-label admin-label-spaced">من صفاته الطيبة:</div>
                        <div class="original-message">${escapeHtml(mem.good_traits)}</div>
                    ` : ''}

                    ${mem.ongoing_charity || linksHtml ? `
                        <div class="original-message-label admin-label-spaced">الصدقة الجارية:</div>
                        ${mem.ongoing_charity ? `<div class="original-message">${escapeHtml(mem.ongoing_charity)}</div>` : ''}
                        ${linksHtml}
                    ` : ''}

                    ${mem.story ? `
                        <div class="original-message-label admin-label-spaced">مواقف أو ذكريات:</div>
                        <div class="original-message">${escapeHtml(mem.story)}</div>
                    ` : ''}

                    ${(!mem.biography && mem.message) ? `
                        <div class="original-message-label admin-label-spaced">الرسالة (قديم):</div>
                        <div class="original-message">${escapeHtml(mem.message)}</div>
                    ` : ''}
                    
                    <div class="actions admin-actions-spaced">
                        <button class="btn btn-success btn-sm" data-memory-action="approve" data-memory-id="${escapeHtml(String(mem.id))}">
                            ✓ موافقة
                        </button>
                        <button class="btn btn-danger btn-sm" data-memory-action="reject" data-memory-id="${escapeHtml(String(mem.id))}">
                            ✗ رفض
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function handleMemoryAction(e) {
        const btn = e.target.closest('[data-memory-action]');
        if (!btn) return;

        const action = btn.dataset.memoryAction;
        const id = btn.dataset.memoryId;

        if (action === 'approve') approveMemory(id);
        if (action === 'reject') rejectMemory(id);
    }

    async function approveMemory(id) {
        try {
            const result = await apiRequest('/api/admin/memory/approve', 'POST', { id });

            if (result.success) {
                showMemoryNotification('تمت الموافقة على صفحة الذكرى', 'success');
                loadPendingMemories(memoriesPage);
            } else {
                showMemoryNotification(result.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            showMemoryNotification('فشل الاتصال بالخادم', 'error');
        }
    }

    async function rejectMemory(id) {
        if (!confirm('هل أنت متأكد من رفض صفحة الذكرى هذه؟')) return;

        try {
            const result = await apiRequest('/api/admin/memory/reject', 'POST', { id });

            if (result.success) {
                showMemoryNotification('تم رفض صفحة الذكرى', 'success');
                loadPendingMemories(memoriesPage);
            } else {
                showMemoryNotification(result.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            showMemoryNotification('فشل الاتصال بالخادم', 'error');
        }
    }

    function showMemoryNotification(message, type) {
        memoryNotification.textContent = message;
        memoryNotification.className = type === 'error' ? 'error-message' : 'success-message';
        memoryNotification.classList.remove('hidden');

        setTimeout(() => {
            memoryNotification.classList.add('hidden');
        }, 3000);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Proposed Edits Moderation (طلبات التعديل)
    // ═══════════════════════════════════════════════════════════════════
    async function loadPendingMemoryUpdates() {
        if (!memoryUpdatesList || !memoryUpdatesLoadingEl) return;
        memoryUpdatesLoadingEl.classList.remove('hidden');
        memoryUpdatesList.classList.add('hidden');
        memoryUpdatesEmptyState.classList.add('hidden');

        try {
            const result = await apiRequest('/api/admin/memory-updates/pending');
            memoryUpdatesLoadingEl.classList.add('hidden');

            if (result.success && result.data && result.data.length > 0) {
                renderMemoryUpdates(result.data);
                memoryUpdatesList.classList.remove('hidden');
            } else {
                memoryUpdatesEmptyState.classList.remove('hidden');
            }
        } catch (error) {
            memoryUpdatesLoadingEl.classList.add('hidden');
            showMemoryUpdateNotification('فشل تحميل طلبات التعديل', 'error');
        }
    }

    function renderMemoryUpdates(proposals) {
        memoryUpdatesList.innerHTML = proposals.map(prop => {
            const memory = prop.memories || {};
            const deceasedName = memory.deceased_name || 'غير معروف';
            const slug = memory.slug || '';
            const pageUrl = `/memory/${slug}`;
            
            // Helper to see if fields have changed
            const isBioChanged = prop.biography !== null && prop.biography !== memory.biography;
            const isTraitsChanged = prop.good_traits !== null && prop.good_traits !== memory.good_traits;
            const isCharityChanged = prop.ongoing_charity !== null && prop.ongoing_charity !== memory.ongoing_charity;
            const isStoryChanged = prop.story !== null && prop.story !== memory.story;
            
            const currentLinksStr = JSON.stringify(memory.external_links || []);
            const proposedLinksStr = JSON.stringify(prop.external_links || []);
            const isLinksChanged = prop.external_links !== null && proposedLinksStr !== currentLinksStr;
            
            // Generate link inputs for editing
            const linksList = Array.isArray(prop.external_links) ? prop.external_links : [];
            let linksEditHtml = '';
            for (let i = 0; i < 5; i++) {
                const link = linksList[i] || { title: '', url: '' };
                linksEditHtml += `
                    <div class="edit-link-row admin-edit-row">
                        <input type="text" 
                               class="update-link-title admin-link-title" 
                               placeholder="عنوان الرابط (مثال: صدقة جارية)" 
                               value="${escapeAttr(link.title || '')}" />
                        <input type="url" 
                               class="update-link-url admin-link-url" 
                               placeholder="https://..." 
                               value="${escapeAttr(link.url || '')}" />
                    </div>
                `;
            }

            return `
                <div class="submission-card memory-update-card" data-proposal-id="${escapeHtml(String(prop.id))}">
                    <div class="submission-meta admin-meta">
                        <span class="content-type-badge admin-meta-badge">طلب تعديل صفحة</span>
                        <span>${formatDate(prop.created_at)}</span>
                    </div>
                    
                    <div>
                        <div class="admin-target">
                            الصفحة المستهدفة: <a href="${pageUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(deceasedName)} ↗</a>
                        </div>
                        <div class="admin-byline">
                            <span>مقدم التعديل: <strong>${escapeHtml(prop.proposed_by_name)}</strong></span>
                            <span>صلة القرابة: <strong>${escapeHtml(prop.proposed_by_relation)}</strong></span>
                        </div>
                    </div>

                    <!-- Comparison Section -->
                    <div class="admin-diff-list">
                        
                        <!-- Biography Diff -->
                        <div class="diff-section${isBioChanged ? ' is-changed' : ''}">
                            <div class="diff-header${isBioChanged ? ' is-changed' : ''}">
                                <span>عن المتوفى وسيرته (نبذة تعريفية)</span>
                                <span class="diff-badge${isBioChanged ? ' is-changed' : ''}">
                                    ${isBioChanged ? 'معدّل 📝' : 'لم يتغير'}
                                </span>
                            </div>
                            <div class="diff-body">
                                <div class="diff-grid">
                                    <div>
                                        <div class="diff-col-label">النسخة الحالية:</div>
                                        <div class="diff-current">${escapeHtml(memory.biography || 'لا يوجد')}</div>
                                    </div>
                                    <div>
                                        <div class="diff-col-label diff-col-label--proposed">النسخة المقترحة:</div>
                                        <div class="diff-proposed">${escapeHtml(prop.biography || 'لا يوجد')}</div>
                                    </div>
                                </div>
                                <div class="diff-edit-wrap">
                                    <label class="diff-edit-label">التعديل النهائي (تعديل واعتماد):</label>
                                    <textarea class="update-biography diff-textarea" rows="2" placeholder="تعديل النبذة قبل الاعتماد...">${escapeHtml(prop.biography || '')}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Traits Diff -->
                        <div class="diff-section${isTraitsChanged ? ' is-changed' : ''}">
                            <div class="diff-header${isTraitsChanged ? ' is-changed' : ''}">
                                <span>من صفاته الحميدة</span>
                                <span class="diff-badge${isTraitsChanged ? ' is-changed' : ''}">
                                    ${isTraitsChanged ? 'معدّل 📝' : 'لم يتغير'}
                                </span>
                            </div>
                            <div class="diff-body">
                                <div class="diff-grid">
                                    <div>
                                        <div class="diff-col-label">النسخة الحالية:</div>
                                        <div class="diff-current">${escapeHtml(memory.good_traits || 'لا يوجد')}</div>
                                    </div>
                                    <div>
                                        <div class="diff-col-label diff-col-label--proposed">النسخة المقترحة:</div>
                                        <div class="diff-proposed">${escapeHtml(prop.good_traits || 'لا يوجد')}</div>
                                    </div>
                                </div>
                                <div class="diff-edit-wrap">
                                    <label class="diff-edit-label">التعديل النهائي (تعديل واعتماد):</label>
                                    <textarea class="update-good-traits diff-textarea" rows="2" placeholder="تعديل الصفات قبل الاعتماد...">${escapeHtml(prop.good_traits || '')}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Charity Diff -->
                        <div class="diff-section${isCharityChanged ? ' is-changed' : ''}">
                            <div class="diff-header${isCharityChanged ? ' is-changed' : ''}">
                                <span>الصدقة الجارية والوقف</span>
                                <span class="diff-badge${isCharityChanged ? ' is-changed' : ''}">
                                    ${isCharityChanged ? 'معدّل 📝' : 'لم يتغير'}
                                </span>
                            </div>
                            <div class="diff-body">
                                <div class="diff-grid">
                                    <div>
                                        <div class="diff-col-label">النسخة الحالية:</div>
                                        <div class="diff-current">${escapeHtml(memory.ongoing_charity || 'لا يوجد')}</div>
                                    </div>
                                    <div>
                                        <div class="diff-col-label diff-col-label--proposed">النسخة المقترحة:</div>
                                        <div class="diff-proposed">${escapeHtml(prop.ongoing_charity || 'لا يوجد')}</div>
                                    </div>
                                </div>
                                <div class="diff-edit-wrap">
                                    <label class="diff-edit-label">التعديل النهائي (تعديل واعتماد):</label>
                                    <textarea class="update-ongoing-charity diff-textarea" rows="2" placeholder="تعديل الصدقة قبل الاعتماد...">${escapeHtml(prop.ongoing_charity || '')}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Links Diff -->
                        <div class="diff-section${isLinksChanged ? ' is-changed' : ''}">
                            <div class="diff-header${isLinksChanged ? ' is-changed' : ''}">
                                <span>روابط الصدقة والمشاريع (حتى 5 روابط)</span>
                                <span class="diff-badge${isLinksChanged ? ' is-changed' : ''}">
                                    ${isLinksChanged ? 'معدّل 📝' : 'لم يتغير'}
                                </span>
                            </div>
                            <div class="diff-body diff-body--wide">
                                <div class="diff-grid">
                                    <div>
                                        <div class="diff-col-label">النسخة الحالية:</div>
                                        <div class="diff-links-current">
                                            <ul class="diff-links-list">
                                                ${(memory.external_links || []).length > 0 
                                                     ? memory.external_links.map(l => `<li>${safeReviewLink(l.url, l.title || l.url)}</li>`).join('')
                                                    : 'لا يوجد روابط'
                                                }
                                            </ul>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="diff-col-label diff-col-label--proposed">النسخة المقترحة:</div>
                                        <div class="diff-links-proposed">
                                            <ul class="diff-links-list">
                                                ${(prop.external_links || []).length > 0 
                                                     ? prop.external_links.map(l => `<li>${safeReviewLink(l.url, l.title || l.url)}</li>`).join('')
                                                    : 'لا يوجد روابط'
                                                }
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <div class="diff-edit-wrap">
                                    <label class="diff-edit-label diff-edit-label--spaced">التعديل النهائي للروابط (تعديل واعتماد):</label>
                                    <div class="update-links-container diff-links-edit">
                                        ${linksEditHtml}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Story Diff -->
                        <div class="diff-section${isStoryChanged ? ' is-changed' : ''}">
                            <div class="diff-header${isStoryChanged ? ' is-changed' : ''}">
                                <span>مواقف وذكريات خالدة (قصص)</span>
                                <span class="diff-badge${isStoryChanged ? ' is-changed' : ''}">
                                    ${isStoryChanged ? 'معدّل 📝' : 'لم يتغير'}
                                </span>
                            </div>
                            <div class="diff-body">
                                <div class="diff-grid">
                                    <div>
                                        <div class="diff-col-label">النسخة الحالية:</div>
                                        <div class="diff-current">${escapeHtml(memory.story || 'لا يوجد')}</div>
                                    </div>
                                    <div>
                                        <div class="diff-col-label diff-col-label--proposed">النسخة المقترحة:</div>
                                        <div class="diff-proposed">${escapeHtml(prop.story || 'لا يوجد')}</div>
                                    </div>
                                </div>
                                <div class="diff-edit-wrap">
                                    <label class="diff-edit-label">التعديل النهائي (تعديل واعتماد):</label>
                                    <textarea class="update-story diff-textarea" rows="3" placeholder="تعديل قصة الذكرى قبل الاعتماد...">${escapeHtml(prop.story || '')}</textarea>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div class="actions admin-update-actions">
                        <button class="btn btn-success btn-md admin-approve-btn" data-update-action="approve" data-proposal-id="${escapeHtml(String(prop.id))}">
                            ✓ اعتماد التعديلات والتدميج ✨
                        </button>
                        <button class="btn btn-danger btn-md admin-reject-btn" data-update-action="reject" data-proposal-id="${escapeHtml(String(prop.id))}">
                            ✗ رفض التعديل
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function handleMemoryUpdateAction(e) {
        const btn = e.target.closest('[data-update-action]');
        if (!btn) return;

        const action = btn.dataset.updateAction;
        const id = btn.dataset.proposalId;

        if (action === 'approve') approveMemoryUpdate(id);
        if (action === 'reject') rejectMemoryUpdate(id);
    }

    async function approveMemoryUpdate(id) {
        const card = document.querySelector(`.memory-update-card[data-proposal-id="${id}"]`);
        if (!card) return;

        // Disable buttons to prevent double-submit
        const btns = card.querySelectorAll('button');
        btns.forEach(b => b.disabled = true);

        // Gather all values from the card's textareas and inputs
        const biography = card.querySelector('.update-biography').value.trim();
        const good_traits = card.querySelector('.update-good-traits').value.trim();
        const ongoing_charity = card.querySelector('.update-ongoing-charity').value.trim();
        const story = card.querySelector('.update-story').value.trim();

        // Gather links
        const linkRows = card.querySelectorAll('.edit-link-row');
        const external_links = [];
        linkRows.forEach(row => {
            const title = row.querySelector('.update-link-title').value.trim();
            const url = row.querySelector('.update-link-url').value.trim();
            if (url) {
                external_links.push({ title: title || url, url });
            }
        });

        const body = {
            id,
            biography,
            good_traits,
            ongoing_charity,
            story,
            external_links
        };

        try {
            const result = await apiRequest('/api/admin/memory-update/approve', 'POST', body);

            if (result.success) {
                showMemoryUpdateNotification('تم دمج واعتماد التعديلات المقترحة بنجاح ✨', 'success');
                card.remove();
                loadStats();
                if (memoryUpdatesList.children.length === 0) {
                    memoryUpdatesList.classList.add('hidden');
                    memoryUpdatesEmptyState.classList.remove('hidden');
                }
            } else {
                showMemoryUpdateNotification(result.message || 'حدث خطأ في معالجة الطلب', 'error');
                btns.forEach(b => b.disabled = false);
            }
        } catch (error) {
            showMemoryUpdateNotification('فشل الاتصال بالخادم', 'error');
            btns.forEach(b => b.disabled = false);
        }
    }

    async function rejectMemoryUpdate(id) {
        if (!confirm('هل أنت متأكد من رفض هذا التعديل المقترح بالكامل؟')) return;

        const card = document.querySelector(`.memory-update-card[data-proposal-id="${id}"]`);
        if (!card) return;

        // Disable buttons
        const btns = card.querySelectorAll('button');
        btns.forEach(b => b.disabled = true);

        try {
            const result = await apiRequest('/api/admin/memory-update/reject', 'POST', { id });

            if (result.success) {
                showMemoryUpdateNotification('تم رفض الاقتراح وحذفه بنجاح', 'success');
                card.remove();
                loadStats();
                if (memoryUpdatesList.children.length === 0) {
                    memoryUpdatesList.classList.add('hidden');
                    memoryUpdatesEmptyState.classList.remove('hidden');
                }
            } else {
                showMemoryUpdateNotification(result.message || 'حدث خطأ في معالجة الطلب', 'error');
                btns.forEach(b => b.disabled = false);
            }
        } catch (error) {
            showMemoryUpdateNotification('فشل الاتصال بالخادم', 'error');
            btns.forEach(b => b.disabled = false);
        }
    }

    function showMemoryUpdateNotification(message, type) {
        if (!memoryUpdatesNotification) return;
        memoryUpdatesNotification.textContent = message;
        memoryUpdatesNotification.className = type === 'error' ? 'error-message' : 'success-message';
        memoryUpdatesNotification.classList.remove('hidden');

        setTimeout(() => {
            memoryUpdatesNotification.classList.add('hidden');
        }, 3500);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Expose functions needed by inline handlers
    // ═══════════════════════════════════════════════════════════════════
    window.logout = logout;
    window.loadPending = loadPending;
    window.switchTab = switchTab;
    window.loadPendingMemories = loadPendingMemories;
    window.loadPendingMemoryUpdates = loadPendingMemoryUpdates;
    window.loadFeedback = loadFeedback;
    window.updateFeedbackStatus = updateFeedbackStatus;

    // ═══════════════════════════════════════════════════════════════════
    // Feedback Messages (Upgraded)
    // ═══════════════════════════════════════════════════════════════════
    const feedbackList = document.getElementById('feedback-list');
    const feedbackLoadingEl = document.getElementById('feedback-loading');
    const feedbackEmptyState = document.getElementById('feedback-empty-state');
    const feedbackFilter = document.getElementById('feedback-filter');
    const feedbackTotal = document.getElementById('feedback-total');
    const feedbackToast = document.getElementById('feedback-toast');
    const feedbackBadge = document.getElementById('feedback-badge');

    const STATUS_LABELS = {
        'New': 'جديدة',
        'In Progress': 'قيد المعالجة',
        'Resolved': 'تم الحل',
        'Archived': 'مؤرشفة',
    };

    const STATUS_COLORS = {
        'New': '#3498db',
        'In Progress': '#e67e22',
        'Resolved': '#27ae60',
        'Archived': '#95a5a6',
    };

    function showToast(message) {
        if (!feedbackToast) return;
        feedbackToast.textContent = message;
        feedbackToast.classList.add('toast-visible');
        setTimeout(() => {
            feedbackToast.classList.remove('toast-visible');
        }, 2500);
    }

    let feedbackPage = 1;

    async function loadFeedback(page = 1) {
        if (!feedbackList || !feedbackLoadingEl) return;
        // Refresh buttons pass the click Event — only honor real numbers
        feedbackPage = typeof page === 'number' && page > 0 ? Math.floor(page) : 1;
        feedbackLoadingEl.classList.remove('hidden');
        feedbackList.classList.add('hidden');
        feedbackEmptyState.classList.add('hidden');
        if (feedbackTotal) feedbackTotal.textContent = '';

        const statusVal = feedbackFilter ? feedbackFilter.value : '';
        const query = new URLSearchParams();
        if (statusVal) query.set('status', statusVal);
        query.set('page', String(feedbackPage));
        const queryStr = `?${query.toString()}`;

        try {
            const result = await apiRequest(`/api/admin/feedback${queryStr}`);
            feedbackLoadingEl.classList.add('hidden');

            if (result.success && result.data && result.data.length > 0) {
                renderFeedback(result.data);
                feedbackList.classList.remove('hidden');
                if (feedbackTotal && result.total !== null && result.total !== undefined) {
                    feedbackTotal.textContent = `${result.total} رسالة`;
                }
                renderPager('feedback', result);
                // Update Badge
                if (feedbackBadge) {
                    if (result.new_count > 0) {
                        feedbackBadge.classList.remove('hidden');
                    } else {
                        feedbackBadge.classList.add('hidden');
                    }
                }
            } else if (feedbackPage > 1) {
                // Page emptied by moderation — step back
                loadFeedback(feedbackPage - 1);
            } else {
                feedbackEmptyState.classList.remove('hidden');
                if (feedbackTotal) feedbackTotal.textContent = '0 رسالة';
                renderPager('feedback', null);
                // Even on empty data, result may carry new_count (e.g. if we are filtering for Archived but have 5 New)
                if (feedbackBadge) {
                    if (result.new_count > 0) {
                        feedbackBadge.classList.remove('hidden');
                    } else {
                        feedbackBadge.classList.add('hidden');
                    }
                }
            }
        } catch (err) {
            feedbackLoadingEl.classList.add('hidden');
            feedbackEmptyState.classList.remove('hidden');
        }
    }

    function renderFeedback(messages) {
        feedbackList.innerHTML = '';
        messages.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'card';
            card.id = `feedback-${msg.id}`;
            card.style.cssText = 'padding:16px;margin-bottom:12px;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface);';

            // --- Header row: name + date + status badge ---
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;';

            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'font-weight:600;font-size:0.95rem;';
            nameSpan.textContent = msg.name || 'مجهول';
            header.appendChild(nameSpan);

            const rightGroup = document.createElement('div');
            rightGroup.style.cssText = 'display:flex;align-items:center;gap:8px;';

            const badge = document.createElement('span');
            const badgeColor = STATUS_COLORS[msg.status] || '#95a5a6';
            badge.style.cssText = `display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.75rem;font-weight:500;color:white;background:${badgeColor};`;
            badge.textContent = STATUS_LABELS[msg.status] || msg.status;
            rightGroup.appendChild(badge);

            const dateSpan = document.createElement('span');
            dateSpan.style.cssText = 'font-size:0.8rem;color:var(--color-text-muted);';
            dateSpan.textContent = formatDate(msg.created_at);
            rightGroup.appendChild(dateSpan);

            header.appendChild(rightGroup);
            card.appendChild(header);

            // --- Email (if exists) ---
            if (msg.email) {
                const emailEl = document.createElement('p');
                emailEl.style.cssText = 'font-size:0.8rem;color:var(--color-accent);margin-bottom:6px;direction:ltr;text-align:left;';
                emailEl.textContent = msg.email;
                card.appendChild(emailEl);
            }

            // --- IP Hash (small muted) ---
            if (msg.ip_hash) {
                const ipEl = document.createElement('p');
                ipEl.style.cssText = 'font-size:0.7rem;color:var(--color-text-muted);margin-bottom:8px;opacity:0.6;direction:ltr;text-align:left;';
                ipEl.textContent = `IP: ${msg.ip_hash.substring(0, 12)}…`;
                card.appendChild(ipEl);
            }

            // --- Message body ---
            const body = document.createElement('p');
            body.style.cssText = 'white-space:pre-wrap;line-height:1.8;margin-bottom:8px;';
            body.textContent = msg.message;
            card.appendChild(body);

            // --- Admin note (if exists) ---
            if (msg.admin_note) {
                const noteEl = document.createElement('p');
                noteEl.style.cssText = 'font-size:0.8rem;color:var(--color-text-muted);font-style:italic;margin-bottom:8px;padding:6px 10px;background:rgba(0,0,0,0.03);border-radius:8px;';
                noteEl.textContent = `ملاحظة: ${msg.admin_note}`;
                card.appendChild(noteEl);
            }

            // --- Action buttons ---
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;';

            if (msg.status !== 'In Progress') {
                const btnProgress = document.createElement('button');
                btnProgress.className = 'btn btn-ghost btn-sm';
                btnProgress.style.cssText = 'font-size:0.78rem;padding:4px 12px;border-radius:8px;color:#e67e22;border-color:#e67e22;';
                btnProgress.textContent = 'قيد المعالجة';
                btnProgress.onclick = () => updateFeedbackStatus(msg.id, 'In Progress');
                actions.appendChild(btnProgress);
            }

            if (msg.status !== 'Resolved') {
                const btnResolved = document.createElement('button');
                btnResolved.className = 'btn btn-ghost btn-sm';
                btnResolved.style.cssText = 'font-size:0.78rem;padding:4px 12px;border-radius:8px;color:#27ae60;border-color:#27ae60;';
                btnResolved.textContent = 'تم الحل';
                btnResolved.onclick = () => updateFeedbackStatus(msg.id, 'Resolved');
                actions.appendChild(btnResolved);
            }

            if (msg.status !== 'Archived') {
                const btnArchive = document.createElement('button');
                btnArchive.className = 'btn btn-ghost btn-sm';
                btnArchive.style.cssText = 'font-size:0.78rem;padding:4px 12px;border-radius:8px;color:#95a5a6;border-color:#95a5a6;';
                btnArchive.textContent = 'أرشفة';
                btnArchive.onclick = () => updateFeedbackStatus(msg.id, 'Archived');
                actions.appendChild(btnArchive);
            }

            card.appendChild(actions);
            feedbackList.appendChild(card);
        });
    }

    async function updateFeedbackStatus(msgId, newStatus) {
        // Prevent race condition: disable all buttons in the card
        const card = document.getElementById(`feedback-${msgId}`);
        const btns = card ? card.querySelectorAll('button') : [];
        btns.forEach(b => b.disabled = true);

        try {
            const result = await apiRequest('/api/admin/feedback/update', 'POST', {
                id: msgId,
                status: newStatus,
            });

            if (result.success) {
                showToast('تم تحديث الحالة بنجاح');
                loadFeedback(feedbackPage); // Refresh current page & badge
            } else {
                showToast(result.message || 'حدث خطأ في التحديث');
                btns.forEach(b => b.disabled = false); // Re-enable on failure
            }
        } catch (err) {
            showToast('فشل الاتصال بالخادم');
            btns.forEach(b => b.disabled = false); // Re-enable on failure
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Initialize
    // ═══════════════════════════════════════════════════════════════════

    // Register delegated event listeners once (prevent memory leaks)
    if (submissionsList) {
        submissionsList.addEventListener('click', handleCardAction);
    }
    if (memoriesList) {
        memoriesList.addEventListener('click', handleMemoryAction);
    }
    if (memoryUpdatesList) {
        memoryUpdatesList.addEventListener('click', handleMemoryUpdateAction);
    }
    if (feedbackFilter) {
        feedbackFilter.addEventListener('change', () => loadFeedback(1));
    }

    wirePager('feedback', () => feedbackPage, loadFeedback);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const tabSubmissionsBtn = document.getElementById('tab-submissions');
    if (tabSubmissionsBtn) tabSubmissionsBtn.addEventListener('click', () => switchTab('submissions'));

    const tabMemoriesBtn = document.getElementById('tab-memories');
    if (tabMemoriesBtn) tabMemoriesBtn.addEventListener('click', () => switchTab('memories'));

    const tabMemoryUpdatesBtn = document.getElementById('tab-memory-updates');
    if (tabMemoryUpdatesBtn) tabMemoryUpdatesBtn.addEventListener('click', () => switchTab('memory-updates'));

    const tabFeedbackBtn = document.getElementById('tab-feedback');
    if (tabFeedbackBtn) tabFeedbackBtn.addEventListener('click', () => switchTab('feedback'));

    const refreshSubmissionsBtn = document.getElementById('refresh-submissions-btn');
    if (refreshSubmissionsBtn) refreshSubmissionsBtn.addEventListener('click', () => loadPending(submissionsPage));

    const refreshMemoriesBtn = document.getElementById('refresh-memories-btn');
    if (refreshMemoriesBtn) refreshMemoriesBtn.addEventListener('click', () => loadPendingMemories(memoriesPage));

    function wirePager(prefix, getPage, loadPage) {
        const prev = document.getElementById(`${prefix}-prev`);
        const next = document.getElementById(`${prefix}-next`);
        if (prev) prev.addEventListener('click', () => loadPage(getPage() - 1));
        if (next) next.addEventListener('click', () => loadPage(getPage() + 1));
    }

    wirePager('submissions', () => submissionsPage, loadPending);
    wirePager('memories', () => memoriesPage, loadPendingMemories);

    const refreshMemoryUpdatesBtn = document.getElementById('refresh-memory-updates-btn');
    if (refreshMemoryUpdatesBtn) refreshMemoryUpdatesBtn.addEventListener('click', loadPendingMemoryUpdates);

    const refreshFeedbackBtn = document.getElementById('refresh-feedback-btn');
    if (refreshFeedbackBtn) refreshFeedbackBtn.addEventListener('click', loadFeedback);

    // Auth key is memory-only — user must re-authenticate on each page load.
    // Session expiry is tracked but does not auto-restore credentials.
})();

