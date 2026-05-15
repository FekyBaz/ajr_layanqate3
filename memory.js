/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Memorial Page Script (memory.js)
 * Public memorial page: fetches memory by slug, renders with textContent,
 * handles interactions with client-side throttling.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════
    const PRODUCTION_API_URL = '';
    const isProduction = !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1');
    const API_BASE = isProduction ? PRODUCTION_API_URL : 'http://localhost:8888';

    // Client-side cooldown per button (UX only — real limit in RPC)
    const INTERACTION_COOLDOWN_MS = 5000;

    // ═══════════════════════════════════════════════════════════════════
    // DOM Elements
    // ═══════════════════════════════════════════════════════════════════
    const loadingEl = document.getElementById('memory-loading');
    const errorEl = document.getElementById('memory-error');
    const errorTextEl = document.getElementById('memory-error-text');
    const cardEl = document.getElementById('memory-card');

    // Header
    const nameEl = document.getElementById('memory-name');
    const relationEl = document.getElementById('memory-relation');
    const activeBadge = document.getElementById('memory-active-badge');
    const approvedBadge = document.getElementById('memory-approved-badge');

    // Sections
    const sectionAbout = document.getElementById('section-about');
    const bioEl = document.getElementById('memory-biography');
    const traitsContainer = document.getElementById('traits-container');
    const traitsEl = document.getElementById('memory-traits');

    const sectionCharity = document.getElementById('section-charity');
    const charityEl = document.getElementById('memory-charity');
    const linksContainer = document.getElementById('links-container');

    const sectionStory = document.getElementById('section-story');
    const storyEl = document.getElementById('memory-story');

    // Legacy fallback
    const messageEl = document.getElementById('memory-message');

    // Counters/Actions
    const counterEl = document.getElementById('memory-counter-value');
    const actionsEl = document.getElementById('memory-actions');

    // State
    let memoryData = null;
    const cooldowns = {};

    // ═══════════════════════════════════════════════════════════════════
    // Slug Extraction
    // ═══════════════════════════════════════════════════════════════════
    function getSlugFromPath() {
        // Try path-based: /memory/slug-here
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[0] === 'memory') {
            return decodeURIComponent(parts[1]);
        }
        // Fallback: ?slug=slug-here (direct URL or query-based access)
        const params = new URLSearchParams(window.location.search);
        const slugParam = params.get('slug');
        if (slugParam && slugParam.trim()) {
            return slugParam.trim();
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // API Helpers
    // ═══════════════════════════════════════════════════════════════════
    async function fetchMemory(slug) {
        const response = await fetch(`${API_BASE}/api/memory/view?slug=${encodeURIComponent(slug)}`);
        return response.json();
    }

    async function sendInteraction(memoryId, interactionType) {
        const response = await fetch(`${API_BASE}/api/memory/interact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memory_id: memoryId,
                interaction_type: interactionType,
            }),
        });
        return response.json();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Render (textContent only — no innerHTML for user data)
    // ═══════════════════════════════════════════════════════════════════
    function renderMemory(memory) {
        // --- Header ---
        nameEl.textContent = memory.deceased_name;
        if (memory.relation) {
            relationEl.textContent = memory.relation;
            relationEl.classList.add('visible');
        }

        // --- Badges (Phase 2 feature retained) ---
        if (memory.is_active) {
            activeBadge.classList.remove('hidden');
        }
        if (memory.approved_at) {
            const approvedDate = new Date(memory.approved_at).toLocaleDateString('ar-EG');
            approvedBadge.textContent = 'نُشرت بتاريخ ' + approvedDate;
            approvedBadge.classList.remove('hidden');
        }

        // --- Structured Content (Phase 3) ---
        let hasStructuredContent = false;

        // About Section
        if (memory.biography || memory.good_traits) {
            hasStructuredContent = true;
            if (memory.biography) {
                bioEl.textContent = memory.biography;
                bioEl.classList.remove('hidden');
            } else {
                bioEl.classList.add('hidden');
            }
            if (memory.good_traits) {
                traitsEl.textContent = memory.good_traits;
                traitsContainer.classList.remove('hidden');
            }
        } else {
            sectionAbout.classList.add('hidden');
        }

        // Charity Section
        let hasCharity = false;
        if (memory.ongoing_charity) {
            charityEl.textContent = memory.ongoing_charity;
            hasCharity = true;
        }

        // External Links mapping safely (XSS defense)
        if (Array.isArray(memory.external_links) && memory.external_links.length > 0) {
            hasCharity = true;
            linksContainer.innerHTML = ''; // clear initial safe
            linksContainer.classList.remove('hidden');

            memory.external_links.forEach(link => {
                if (!link.url) return;
                const a = document.createElement('a');
                a.href = link.url;
                a.className = 'external-link';
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = link.title || link.url;
                linksContainer.appendChild(a);
            });
        }

        if (hasCharity) sectionCharity.classList.remove('hidden');

        // Story Section
        if (memory.story) {
            hasStructuredContent = true;
            storyEl.textContent = memory.story;
            sectionStory.classList.remove('hidden');
        }

        // Legacy Fallback (if no bio exists, show old message)
        if (!hasStructuredContent && memory.message) {
            messageEl.textContent = memory.message;
            messageEl.classList.remove('hidden');
        }

        // --- Counters ---
        counterEl.textContent = formatNumber(memory.total_interactions || 0);

        // Update specific counts on buttons
        const btnTasbeeh = document.getElementById('count-tasbeeh');
        const btnDua = document.getElementById('count-dua');
        const btnShare = document.getElementById('count-share');
        if (btnTasbeeh) btnTasbeeh.textContent = formatNumber(memory.tasbeeh_count || 0);
        if (btnDua) btnDua.textContent = formatNumber(memory.dua_count || 0);
        if (btnShare) btnShare.textContent = formatNumber(memory.share_count || 0);

        // Update page title
        document.title = `صدقة جارية على روح ${memory.deceased_name} | أجر لا ينقطع`;

        // Show card, hide loading
        loadingEl.classList.add('hidden');
        cardEl.classList.remove('hidden');
    }

    function showError(message) {
        errorTextEl.textContent = message;
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
    }

    function formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Counter Animation
    // ═══════════════════════════════════════════════════════════════════
    function bumpCounter(newTotal) {
        counterEl.textContent = formatNumber(newTotal);
        counterEl.classList.add('bumped');
        setTimeout(() => counterEl.classList.remove('bumped'), 200);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Ripple Effect
    // ═══════════════════════════════════════════════════════════════════
    function createRipple(button, event) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
        button.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    }

    // ═══════════════════════════════════════════════════════════════════
    // Share Functionality
    // ═══════════════════════════════════════════════════════════════════
    async function handleShare() {
        const url = window.location.href;
        const title = `صدقة جارية على روح ${memoryData.deceased_name}`;

        if (navigator.share) {
            try {
                await navigator.share({ title, url });
            } catch (e) {
                // User cancelled or error — fall through to clipboard
                if (e.name !== 'AbortError') {
                    copyToClipboard(url);
                }
            }
        } else {
            copyToClipboard(url);
        }
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('تم نسخ الرابط');
        }).catch(() => {
            // Fallback
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showToast('تم نسخ الرابط');
        });
    }

    function showToast(message) {
        // Create a temporary toast notification
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
            background: var(--color-accent, #8c6a35); color: white;
            padding: 10px 24px; border-radius: 999px; font-size: 14px;
            font-family: var(--font-primary); z-index: 9999;
            opacity: 0; transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Interaction Handler (Event Delegation)
    // ═══════════════════════════════════════════════════════════════════
    actionsEl.addEventListener('click', async function (e) {
        const btn = e.target.closest('.memory-btn');
        if (!btn || !memoryData) return;

        const type = btn.dataset.type;
        if (!type) return;

        // Share has special handling
        if (type === 'share') {
            createRipple(btn, e);
            handleShare();
            // Also record the share interaction
            sendInteraction(memoryData.id, 'share').catch(() => { });
            return;
        }

        // Client-side cooldown (UX only)
        if (cooldowns[type]) return;

        // Visual feedback
        createRipple(btn, e);
        btn.classList.add('cooldown');
        cooldowns[type] = true;

        try {
            const result = await sendInteraction(memoryData.id, type);
            if (result.success && result.total_interactions) {
                bumpCounter(result.total_interactions);
            }
        } catch (err) {
            // Silent fail — don't disrupt UX
        }

        // Cooldown timer
        setTimeout(() => {
            btn.classList.remove('cooldown');
            cooldowns[type] = false;
        }, INTERACTION_COOLDOWN_MS);
    });

    // ═══════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════
    async function init() {
        const slug = getSlugFromPath();

        if (!slug) {
            showError('لم يتم العثور على رابط صالح');
            return;
        }

        try {
            const result = await fetchMemory(slug);

            if (result.success && result.memory) {
                memoryData = result.memory; // Store for interactions
                renderMemory(memoryData);
            } else {
                showError(result.message || 'عذراً، لم نتمكن من إيجاد الصفحة المطلوبة');
            }
        } catch (err) {
            showError('حدث خطأ أثناء تحميل البيانات. يرجى التأكد من اتصالك بالإنترنت وتحديث الصفحة.');
        }
    }

    // Start
    init();

})();
