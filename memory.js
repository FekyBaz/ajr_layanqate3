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
    const bioContainer = document.getElementById('bio-container');
    const bioEl = document.getElementById('memory-biography');
    const traitsContainer = document.getElementById('traits-container');
    const traitsEl = document.getElementById('memory-traits');

    const sectionCharity = document.getElementById('section-charity');
    const charityTextContainer = document.getElementById('charity-text-container');
    const charityEl = document.getElementById('memory-charity');
    const charityLinksContainer = document.getElementById('charity-links-container');
    const linksContainer = document.getElementById('links-container');

    const sectionStory = document.getElementById('section-story');
    const storyEl = document.getElementById('memory-story');

    // Legacy fallback
    const messageEl = document.getElementById('memory-message');

    // Share Button
    const btnSharePage = document.getElementById('btn-share-page');

    // State
    let memoryData = null;

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
            sectionAbout.classList.remove('hidden');

            if (memory.biography) {
                bioEl.textContent = memory.biography;
                bioContainer.classList.remove('hidden');
            } else {
                bioContainer.classList.add('hidden');
            }

            if (memory.good_traits) {
                traitsEl.textContent = memory.good_traits;
                traitsContainer.classList.remove('hidden');
                traitsContainer.style.marginTop = memory.biography ? '20px' : '0';
            } else {
                traitsContainer.classList.add('hidden');
            }
        } else {
            sectionAbout.classList.add('hidden');
        }

        // Charity Section
        let hasCharity = false;
        const validLinks = Array.isArray(memory.external_links) ? memory.external_links.filter(link => link && link.url) : [];
        const hasLinks = validLinks.length > 0;

        if (memory.ongoing_charity || hasLinks) {
            hasCharity = true;
            sectionCharity.classList.remove('hidden');

            if (memory.ongoing_charity) {
                charityEl.textContent = memory.ongoing_charity;
                charityTextContainer.classList.remove('hidden');
            } else {
                charityTextContainer.classList.add('hidden');
            }

            if (hasLinks) {
                charityLinksContainer.classList.remove('hidden');
                charityLinksContainer.style.marginTop = memory.ongoing_charity ? '20px' : '0';
                linksContainer.innerHTML = ''; // clear initial safe

                validLinks.forEach(link => {
                    const a = document.createElement('a');
                    a.href = link.url;
                    a.className = 'external-link';
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.textContent = link.title || link.url;
                    linksContainer.appendChild(a);
                });
            } else {
                charityLinksContainer.classList.add('hidden');
            }
        } else {
            sectionCharity.classList.add('hidden');
        }

        // Story Section
        if (memory.story) {
            hasStructuredContent = true;
            storyEl.textContent = memory.story;
            sectionStory.classList.remove('hidden');
        } else {
            sectionStory.classList.add('hidden');
        }

        // Legacy Fallback (if no bio exists, show old message)
        if (!hasStructuredContent && memory.message) {
            messageEl.textContent = memory.message;
            messageEl.classList.remove('hidden');
        } else {
            messageEl.classList.add('hidden');
        }

        // Update page title
        document.title = `صدقة جارية على روح ${memory.deceased_name} | أجر لا ينقطع`;

        // Show card, hide loading
        loadingEl.classList.add('hidden');
        cardEl.classList.remove('hidden');

        // Initialize Dhikr Cards
        initDhikrSection(memory);

        // Initialize Surah Yaseen Modal
        initYaseenModal(memory);

        // Initialize Proposed Edit Modal
        initEditModal(memory);
    }

    function showError(message) {
        errorTextEl.textContent = message;
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
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
    // Share Button Handler
    // ═══════════════════════════════════════════════════════════════════
    if (btnSharePage) {
        btnSharePage.addEventListener('click', function (e) {
            if (!memoryData) return;
            createRipple(btnSharePage, e);
            handleShare();
            sendInteraction(memoryData.id, 'share').catch(() => { });
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Dedicate Dhikr (Tasbeeh) Section
    // ═══════════════════════════════════════════════════════════════════
    const azkar = [
        { id: 1, text: "سبحان الله", target: 33 },
        { id: 2, text: "الحمد لله", target: 33 },
        { id: 3, text: "الله أكبر", target: 33 },
        { id: 4, text: "لا إله إلا الله", target: 33 },
    ];

    function initDhikrSection(memory) {
        const sectionDhikr = document.getElementById('section-dhikr');
        const container = document.getElementById('dhikr-cards-container');
        if (!sectionDhikr || !container) return;

        sectionDhikr.classList.remove('hidden');
        container.innerHTML = '';

        const slugKey = memory.slug || memory.id;

        azkar.forEach(item => {
            const storageKey = `ajr_dhikr_${slugKey}_${item.id}`;
            let currentVal = parseInt(localStorage.getItem(storageKey), 10) || 0;
            if (currentVal > item.target) currentVal = item.target;

            const isCompleted = currentVal >= item.target;
            const progressPercent = Math.min(100, Math.round((currentVal / item.target) * 100));

            const card = document.createElement('div');
            card.className = `dhikr-card ${isCompleted ? 'completed' : ''}`;
            card.dataset.id = item.id;

            card.innerHTML = `
                <div class="dhikr-card__header">
                    <span class="dhikr-card__title">${item.text}</span>
                    <span class="dhikr-card__badge">الهدف ${item.target}</span>
                </div>
                
                <div class="dhikr-card__counter">
                    <span class="dhikr-card__number" id="dhikr-num-${item.id}">${currentVal}</span>
                    <span class="dhikr-card__divider">/</span>
                    <span class="dhikr-card__total">${item.target}</span>
                </div>
                
                <div class="dhikr-card__track">
                    <div class="dhikr-card__bar" id="dhikr-bar-${item.id}" style="width: ${progressPercent}%;"></div>
                </div>
                
                <div class="dhikr-card__buttons">
                    <button class="dhikr-btn dhikr-btn--tasbeeh" id="dhikr-btn-${item.id}" ${isCompleted ? 'disabled' : ''} type="button">
                        <span class="dhikr-btn__icon" id="dhikr-btn-icon-${item.id}" aria-hidden="true">${isCompleted ? '✓' : '📿'}</span>
                        <span class="dhikr-btn__text" id="dhikr-btn-text-${item.id}">${isCompleted ? 'تمت' : 'تسبيحة'}</span>
                    </button>
                    <button class="dhikr-btn dhikr-btn--reset" id="dhikr-reset-${item.id}" title="إعادة العداد للصفر" type="button">
                        <span aria-hidden="true">↺</span>
                    </button>
                </div>
            `;

            container.appendChild(card);

            const countBtn = card.querySelector(`#dhikr-btn-${item.id}`);
            const resetBtn = card.querySelector(`#dhikr-reset-${item.id}`);
            const numEl = card.querySelector(`#dhikr-num-${item.id}`);
            const barEl = card.querySelector(`#dhikr-bar-${item.id}`);
            const btnText = card.querySelector(`#dhikr-btn-text-${item.id}`);
            const btnIcon = card.querySelector(`#dhikr-btn-icon-${item.id}`);

            let isThrottled = false;

            countBtn.addEventListener('click', (e) => {
                if (isThrottled || currentVal >= item.target) return;
                isThrottled = true;
                setTimeout(() => { isThrottled = false; }, 80);

                createRipple(countBtn, e);

                currentVal++;
                localStorage.setItem(storageKey, currentVal);

                numEl.textContent = currentVal;
                numEl.style.transform = 'scale(1.25)';
                setTimeout(() => { numEl.style.transform = 'scale(1)'; }, 150);

                const newPct = Math.min(100, Math.round((currentVal / item.target) * 100));
                barEl.style.width = `${newPct}%`;

                if (currentVal >= item.target) {
                    card.classList.add('completed', 'celebrate');
                    countBtn.disabled = true;
                    btnText.textContent = 'تمت';
                    btnIcon.textContent = '✓';

                    if (navigator.vibrate) {
                        try { navigator.vibrate([50, 50, 50]); } catch (err) { }
                    }
                    showToast(`تقبل الله! أتممت تسبيح "${item.text}"`);

                    sendInteraction(memory.id, 'tasbeeh').catch(() => { });
                }
            });

            resetBtn.addEventListener('click', () => {
                currentVal = 0;
                localStorage.setItem(storageKey, 0);

                card.classList.remove('completed', 'celebrate');
                countBtn.disabled = false;
                btnText.textContent = 'تسبيحة';
                btnIcon.textContent = '📿';

                numEl.textContent = '0';
                barEl.style.width = '0%';
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Quran Dedication (Surah Yaseen Modal)
    // ═══════════════════════════════════════════════════════════════════
    function initYaseenModal(memory) {
        const btnOpen = document.getElementById('btn-open-yaseen');
        const modal = document.getElementById('yaseen-modal');
        const btnClose = document.getElementById('btn-close-yaseen');
        const backdrop = modal ? modal.querySelector('.yaseen-modal__backdrop') : null;
        const btnComplete = document.getElementById('btn-complete-yaseen');

        if (!btnOpen || !modal) return;

        const useHelper = typeof window.ModalHelper !== 'undefined';

        function openModal() {
            if (useHelper) {
                window.ModalHelper.open(modal, btnOpen);
                return;
            }
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            // Reset scroll position to top of Surah Yaseen when opened
            const bodyEl = modal.querySelector('.yaseen-modal__body');
            if (bodyEl) bodyEl.scrollTop = 0;
            const fallbackFocus = modal.querySelector('[data-autofocus]') || btnClose;
            if (fallbackFocus) fallbackFocus.focus();
        }

        function closeModal() {
            if (useHelper) {
                window.ModalHelper.close(modal);
                return;
            }
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            btnOpen.focus();
        }

        btnOpen.addEventListener('click', function(e) {
            createRipple(btnOpen, e);
            openModal();
        });

        if (btnClose) {
            btnClose.addEventListener('click', closeModal);
        }

        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }

        if (!useHelper) {
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    closeModal();
                }
            });
        }

        if (btnComplete) {
            btnComplete.addEventListener('click', function(e) {
                createRipple(btnComplete, e);
                closeModal();
                showToast('تقبل الله منكم قراءة سورة يس وإهداء ثوابها للمتوفى');
                if (memory) {
                    sendInteraction(memory.id, 'yaseen').catch(() => {});
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Proposed Edit Modal Logic
    // ═══════════════════════════════════════════════════════════════════
    function initEditModal(memory) {
        const btnOpen = document.getElementById('btn-open-edit');
        const modal = document.getElementById('edit-modal');
        const btnClose = document.getElementById('btn-close-edit');
        const btnCancel = document.getElementById('btn-cancel-edit');
        const btnSubmit = document.getElementById('btn-submit-edit');
        const backdrop = modal ? modal.querySelector('#edit-modal-backdrop') : null;
        const form = document.getElementById('edit-memory-form');

        // Form Fields
        const proposedByName = document.getElementById('edit-proposed-by-name');
        const proposedByRelation = document.getElementById('edit-proposed-by-relation');
        const biography = document.getElementById('edit-biography');
        const goodTraits = document.getElementById('edit-good-traits');
        const ongoingCharity = document.getElementById('edit-ongoing-charity');
        const story = document.getElementById('edit-story');
        const linksContainer = document.getElementById('edit-links-container');
        const addLinkBtn = document.getElementById('edit-add-link-btn');
        const formStatus = document.getElementById('edit-form-status');

        // Character counters
        const bioCount = document.getElementById('edit-bio-char-count');
        const traitsCount = document.getElementById('edit-traits-char-count');
        const charityCount = document.getElementById('edit-charity-char-count');
        const storyCount = document.getElementById('edit-story-char-count');

        if (!btnOpen || !modal) return;

        function updateCharCount(el, countEl, max) {
            if (!el || !countEl) return;
            const current = el.value.length;
            countEl.textContent = `${current} / ${max}`;
        }

        function setupCharCount(el, countEl, max) {
            if (!el || !countEl) return;
            updateCharCount(el, countEl, max);
            el.addEventListener('input', () => updateCharCount(el, countEl, max));
        }

        // Setup character counts
        setupCharCount(biography, bioCount, 1000);
        setupCharCount(goodTraits, traitsCount, 500);
        setupCharCount(ongoingCharity, charityCount, 1000);
        setupCharCount(story, storyCount, 2000);

        // Links management
        function createLinkRow(titleVal = '', urlVal = '') {
            const rows = linksContainer.querySelectorAll('.edit-link-row');
            if (rows.length >= 5) {
                showToast('الحد الأقصى هو 5 روابط');
                return;
            }

            const row = document.createElement('div');
            row.className = 'edit-link-row';
            row.style.cssText = 'display: flex; gap: 8px; align-items: center; width: 100%;';
            row.innerHTML = `
                <input type="text" class="link-title" placeholder="اسم الرابط (مثال: منصة إحسان)" value="${titleVal}" style="flex: 2; padding: 6px 10px; font-size: 0.85rem; border: 1px solid var(--color-border, #ddd); border-radius: 6px; background: var(--color-surface, #fff); box-sizing: border-box;">
                <input type="url" class="link-url" placeholder="رابط التبرع (https://...)" value="${urlVal}" style="flex: 3; padding: 6px 10px; font-size: 0.85rem; border: 1px solid var(--color-border, #ddd); border-radius: 6px; background: var(--color-surface, #fff); direction: ltr; text-align: left; box-sizing: border-box;">
                <button type="button" class="btn-remove-link" title="حذف الرابط" style="padding: 6px 10px; background: transparent; border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; border-radius: 6px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; height: 32px; width: 32px;">×</button>
            `;

            row.querySelector('.btn-remove-link').addEventListener('click', () => {
                row.remove();
            });

            linksContainer.appendChild(row);
        }

        if (addLinkBtn) {
            addLinkBtn.addEventListener('click', () => {
                createLinkRow();
            });
        }

        function populateForm() {
            form.reset();
            biography.value = memory.biography || '';
            goodTraits.value = memory.good_traits || '';
            ongoingCharity.value = memory.ongoing_charity || '';
            story.value = memory.story || '';

            // Update char counts
            updateCharCount(biography, bioCount, 1000);
            updateCharCount(goodTraits, traitsCount, 500);
            updateCharCount(ongoingCharity, charityCount, 1000);
            updateCharCount(story, storyCount, 2000);

            // Pop links
            linksContainer.innerHTML = '';
            if (Array.isArray(memory.external_links)) {
                memory.external_links.forEach(link => {
                    createLinkRow(link.title || '', link.url || '');
                });
            }
            if (linksContainer.querySelectorAll('.edit-link-row').length === 0) {
                createLinkRow(); // Add one default empty row
            }

            formStatus.style.display = 'none';
        }

        function openModal() {
            populateForm();
            if (typeof window.ModalHelper !== 'undefined') {
                window.ModalHelper.open(modal, btnOpen);
                return;
            }
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            modal.querySelector('.yaseen-modal__body').scrollTop = 0;
            const fallbackFocus = modal.querySelector('[data-autofocus]') || btnClose;
            if (fallbackFocus) fallbackFocus.focus();
        }

        function closeModal() {
            if (typeof window.ModalHelper !== 'undefined') {
                window.ModalHelper.close(modal);
                return;
            }
            modal.classList.add('hidden');
            document.body.style.overflow = '';
            btnOpen.focus();
        }

        btnOpen.addEventListener('click', (e) => {
            createRipple(btnOpen, e);
            openModal();
        });

        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (btnCancel) btnCancel.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);

        if (typeof window.ModalHelper === 'undefined') {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    closeModal();
                }
            });
        }

        // Submit action
        btnSubmit.addEventListener('click', async (e) => {
            createRipple(btnSubmit, e);
            formStatus.style.display = 'none';

            // Validate required
            const editorName = proposedByName.value.trim();
            const editorRelation = proposedByRelation.value.trim();

            if (!editorName || editorName.length < 3) {
                showStatus('يرجى إدخال اسمك الكريم (3 أحرف على الأقل)', 'error');
                proposedByName.focus();
                return;
            }
            if (!editorRelation || editorRelation.length < 3) {
                showStatus('يرجى إدخال صلة قرابتك بالمتوفى (3 أحرف على الأقل)', 'error');
                proposedByRelation.focus();
                return;
            }

            // Gather external links
            const links = [];
            const rows = linksContainer.querySelectorAll('.edit-link-row');
            let linksError = null;

            rows.forEach(row => {
                const title = row.querySelector('.link-title').value.trim();
                const url = row.querySelector('.link-url').value.trim();

                if (url) {
                    if (!/^https?:\/\/.+/i.test(url)) {
                        linksError = 'يرجى إدخال رابط تبرع صحيح يبدأ بـ http:// أو https://';
                    }
                    links.push({ title: title || url, url });
                }
            });

            if (linksError) {
                showStatus(linksError, 'error');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'جاري إرسال طلبك...';

            try {
                const response = await fetch(`${API_BASE}/api/memory/update-propose`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        memory_id: memory.id,
                        proposed_by_name: editorName,
                        proposed_by_relation: editorRelation,
                        biography: biography.value.trim(),
                        good_traits: goodTraits.value.trim(),
                        ongoing_charity: ongoingCharity.value.trim(),
                        external_links: links,
                        story: story.value.trim()
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showToast('تم إرسال اقتراح التعديل بنجاح لمراجعته.');
                    closeModal();
                    proposedByName.value = '';
                    proposedByRelation.value = '';
                } else {
                    showStatus(result.message || 'فشل إرسال التعديل. يرجى المحاولة مرة أخرى.', 'error');
                }
            } catch (err) {
                showStatus('حدث خطأ أثناء الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.', 'error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'إرسال طلب التعديل ✨';
            }
        });

        function showStatus(msg, type) {
            formStatus.textContent = msg;
            formStatus.style.display = 'block';
            formStatus.style.cssText = `
                display: block;
                font-size: 0.9rem;
                text-align: center;
                border-radius: 8px;
                padding: 10px;
                margin-top: 12px;
                background: ${type === 'error' ? '#fde2e2' : '#e2fdf2'};
                color: ${type === 'error' ? '#c0392b' : '#27ae60'};
                border: 1px solid ${type === 'error' ? '#f5b7b7' : '#b7f5d6'};
            `;
        }
    }

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
