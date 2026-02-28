// ═══════════════════════════════════════════════════════════════════════════
// أجر لا ينقطع - Admin Panel Script
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════
    /**
     * ⚠️ PRODUCTION API URL
     * Change this to your production backend URL (e.g., Railway, Render, Vercel)
     * Leave empty if frontend and backend are on the same domain.
     */
    const PRODUCTION_API_URL = '';

    const isProduction = !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1');
    const API_BASE = isProduction ? PRODUCTION_API_URL : 'http://localhost:8888';

    let adminKey = localStorage.getItem('adminKey') || '';

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

    // ═══════════════════════════════════════════════════════════════════
    // API Helpers
    // ═══════════════════════════════════════════════════════════════════
    async function apiRequest(endpoint, method = 'GET', body = null) {
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

        const response = await fetch(`${API_BASE}${endpoint}`, options);
        return response.json();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Authentication
    // ═══════════════════════════════════════════════════════════════════
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        adminKey = apiKeyInput.value.trim();

        if (!adminKey) {
            showLoginError('يرجى إدخال مفتاح API');
            return;
        }

        try {
            const result = await apiRequest('/api/admin/stats');

            if (result.success) {
                localStorage.setItem('adminKey', adminKey);
                showAdminPanel();
            } else {
                showLoginError('مفتاح API غير صحيح');
            }
        } catch (error) {
            showLoginError('فشل الاتصال بالخادم');
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
        localStorage.removeItem('adminKey');
        loginSection.classList.remove('hidden');
        adminSection.classList.add('hidden');
        apiKeyInput.value = '';
    }

    function showAdminPanel() {
        loginSection.classList.add('hidden');
        adminSection.classList.remove('hidden');
        loadStats();
        loadPending();
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

    async function loadPending() {
        loadingEl.classList.remove('hidden');
        submissionsList.classList.add('hidden');
        emptyState.classList.add('hidden');

        try {
            const result = await apiRequest('/api/admin/pending');

            loadingEl.classList.add('hidden');

            if (result.success && result.data.length > 0) {
                renderSubmissions(result.data);
                submissionsList.classList.remove('hidden');
            } else {
                emptyState.classList.remove('hidden');
            }
        } catch (error) {
            loadingEl.classList.add('hidden');
            showNotification('فشل تحميل البيانات', 'error');
        }
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

        // Use event delegation instead of inline onclick
        submissionsList.addEventListener('click', handleCardAction);
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
                removeCard(id);
                loadStats();
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
                removeCard(id);
                loadStats();
            } else {
                showNotification(result.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            showNotification('فشل الاتصال بالخادم', 'error');
        }
    }

    function removeCard(id) {
        const card = document.querySelector(`.submission-card[data-id="${id}"]`);
        if (card) {
            card.remove();
        }

        if (submissionsList.children.length === 0) {
            submissionsList.classList.add('hidden');
            emptyState.classList.remove('hidden');
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
        const tabSubmissions = document.getElementById('tab-submissions');
        const tabMemories = document.getElementById('tab-memories');

        if (tabName === 'submissions') {
            submissionsTab.classList.remove('hidden');
            memoriesTab.classList.add('hidden');
            tabSubmissions.className = 'btn btn-primary btn-sm admin-tab active';
            tabMemories.className = 'btn btn-ghost btn-sm admin-tab';
        } else {
            submissionsTab.classList.add('hidden');
            memoriesTab.classList.remove('hidden');
            tabSubmissions.className = 'btn btn-ghost btn-sm admin-tab';
            tabMemories.className = 'btn btn-primary btn-sm admin-tab active';
            loadPendingMemories();
        }
    }

    async function loadPendingMemories() {
        memoryLoadingEl.classList.remove('hidden');
        memoriesList.classList.add('hidden');
        memoryEmptyState.classList.add('hidden');

        try {
            const result = await apiRequest('/api/admin/memory/pending');

            memoryLoadingEl.classList.add('hidden');

            if (result.success && result.data.length > 0) {
                renderMemories(result.data);
                memoriesList.classList.remove('hidden');
                document.getElementById('memory-pending-count').textContent = result.data.length;
            } else {
                memoryEmptyState.classList.remove('hidden');
                document.getElementById('memory-pending-count').textContent = '0';
            }
        } catch (error) {
            memoryLoadingEl.classList.add('hidden');
            showMemoryNotification('فشل تحميل البيانات', 'error');
        }
    }

    function renderMemories(memories) {
        memoriesList.innerHTML = memories.map(mem => `
            <div class="submission-card" data-memory-id="${escapeHtml(String(mem.id))}">
                <div class="submission-meta">
                    <span class="content-type-badge">صدقة جارية</span>
                    <span>${formatDate(mem.created_at)}</span>
                </div>
                
                <div class="original-message-label">اسم المتوفى:</div>
                <div class="original-message" style="font-weight:600;">${escapeHtml(mem.deceased_name)}</div>
                
                ${mem.relation ? `<div style="font-size:0.85rem;color:#8b7961;margin-top:4px;">صلة القرابة: ${escapeHtml(mem.relation)}</div>` : ''}
                
                <div class="original-message-label" style="margin-top:12px;">الرسالة:</div>
                <div class="original-message">${escapeHtml(mem.message)}</div>
                
                <div class="actions">
                    <button class="btn btn-success btn-sm" data-memory-action="approve" data-memory-id="${escapeHtml(String(mem.id))}">
                        ✓ موافقة
                    </button>
                    <button class="btn btn-danger btn-sm" data-memory-action="reject" data-memory-id="${escapeHtml(String(mem.id))}">
                        ✗ رفض
                    </button>
                </div>
            </div>
        `).join('');

        // Event delegation for memory actions
        memoriesList.addEventListener('click', handleMemoryAction);
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
                removeMemoryCard(id);
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
                removeMemoryCard(id);
            } else {
                showMemoryNotification(result.message || 'حدث خطأ', 'error');
            }
        } catch (error) {
            showMemoryNotification('فشل الاتصال بالخادم', 'error');
        }
    }

    function removeMemoryCard(id) {
        const card = document.querySelector(`.submission-card[data-memory-id="${id}"]`);
        if (card) card.remove();

        if (memoriesList.children.length === 0) {
            memoriesList.classList.add('hidden');
            memoryEmptyState.classList.remove('hidden');
        }

        // Update count
        const countEl = document.getElementById('memory-pending-count');
        const current = parseInt(countEl.textContent) || 0;
        countEl.textContent = Math.max(0, current - 1);
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
    // Expose functions needed by inline handlers
    // ═══════════════════════════════════════════════════════════════════
    window.logout = logout;
    window.loadPending = loadPending;
    window.switchTab = switchTab;
    window.loadPendingMemories = loadPendingMemories;

    // ═══════════════════════════════════════════════════════════════════
    // Initialize
    // ═══════════════════════════════════════════════════════════════════
    if (adminKey) {
        apiRequest('/api/admin/stats')
            .then(result => {
                if (result.success) {
                    showAdminPanel();
                } else {
                    logout();
                }
            })
            .catch(() => logout());
    }
})();

