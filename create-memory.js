/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Create Memory Form Script (create-memory.js)
 * Handles memory creation: Arabic-only validation, character limits,
 * client-side rate limit indicator, form submission.
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

    // Arabic-only pattern (mirrors ARABIC_PATTERN from shared.js)
    const ARABIC_PATTERN = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669\s\d.,،؛:؟!()«»/\-#_…\\\n\r🌿"']+$/;

    const NAME_MAX_LENGTH = 100;
    const MESSAGE_MIN_LENGTH = 3;
    const MESSAGE_MAX_LENGTH = 1000;

    // Client-side submission cooldown
    const SUBMIT_COOLDOWN_MS = 30000;
    let lastSubmitTime = 0;

    // ═══════════════════════════════════════════════════════════════════
    // DOM Elements
    // ═══════════════════════════════════════════════════════════════════
    const form = document.getElementById('create-memory-form');
    const nameInput = document.getElementById('deceased-name');
    const relationInput = document.getElementById('relation');

    // Structured Fields
    const bioInput = document.getElementById('biography');
    const traitsInput = document.getElementById('good-traits');
    const charityInput = document.getElementById('ongoing-charity');
    const storyInput = document.getElementById('story');

    // Links Section
    const linksContainer = document.getElementById('links-container');
    const addLinkBtn = document.getElementById('add-link-btn');
    const linksError = document.getElementById('links-error');

    // UI elements
    const submitBtn = document.getElementById('submit-btn');
    const formStatus = document.getElementById('form-status');

    // Counters & Errors
    const elements = {
        name: { input: nameInput, count: document.getElementById('name-char-count'), error: document.getElementById('name-error'), max: 100 },
        bio: { input: bioInput, count: document.getElementById('bio-char-count'), error: document.getElementById('bio-error'), max: 1000 },
        traits: { input: traitsInput, count: document.getElementById('traits-char-count'), error: document.getElementById('traits-error'), max: 500 },
        charity: { input: charityInput, count: document.getElementById('charity-char-count'), error: document.getElementById('charity-error'), max: 1000 },
        story: { input: storyInput, count: document.getElementById('story-char-count'), error: document.getElementById('story-error'), max: 2000 }
    };

    // ═══════════════════════════════════════════════════════════════════
    // Core Logic (Counts & Validation UI)
    // ═══════════════════════════════════════════════════════════════════

    // Attach counters
    Object.values(elements).forEach(item => {
        if (!item.input) return;
        item.input.addEventListener('input', () => {
            const len = item.input.value.length;
            item.count.textContent = `${len} / ${item.max}`;
            item.count.classList.toggle('over-limit', len > item.max);
            clearFieldError(item.error);
        });
    });

    function showFieldError(el, message) {
        if (!el) return;
        el.textContent = message;
        el.classList.add('visible');
    }

    function clearFieldError(el) {
        if (!el) return;
        el.textContent = '';
        el.classList.remove('visible');
    }

    function showStatus(message, type) {
        formStatus.textContent = message;
        formStatus.className = 'form-status ' + type;
    }

    function clearStatus() {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
    }

    // ═══════════════════════════════════════════════════════════════════
    // Dynamic Links Handler
    // ═══════════════════════════════════════════════════════════════════
    const MAX_LINKS = 5;

    function createLinkRow() {
        const row = document.createElement('div');
        row.className = 'link-row';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'اسم المؤسسة/المنصة (مثال: منصة إحسان)';
        titleInput.className = 'link-title';
        titleInput.maxLength = 100;

        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.placeholder = 'https://...';
        urlInput.className = 'link-url';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-link-btn';
        removeBtn.innerHTML = '✕';
        removeBtn.title = 'حذف الرابط';
        removeBtn.onclick = () => {
            row.remove();
            updateAddLinkBtn();
        };

        row.appendChild(titleInput);
        row.appendChild(urlInput);
        row.appendChild(removeBtn);

        linksContainer.appendChild(row);
        updateAddLinkBtn();
    }

    function updateAddLinkBtn() {
        const count = linksContainer.querySelectorAll('.link-row').length;
        addLinkBtn.disabled = count >= MAX_LINKS;
    }

    if (addLinkBtn) {
        addLinkBtn.addEventListener('click', () => {
            if (linksContainer.querySelectorAll('.link-row').length < MAX_LINKS) {
                createLinkRow();
            }
        });
    }

    function getExternalLinks() {
        const links = [];
        const rows = linksContainer.querySelectorAll('.link-row');
        rows.forEach(row => {
            const title = row.querySelector('.link-title').value.trim();
            const url = row.querySelector('.link-url').value.trim();
            if (url) { // Title is optional, URL is required if row exists
                links.push({ title, url });
            }
        });
        return links.length ? links : null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Validation
    // ═══════════════════════════════════════════════════════════════════
    function validateInput(value, name, min, max, required = false) {
        const trimmed = value.trim();
        if (!trimmed) return required ? `${name} مطلوب` : null;
        if (trimmed.length < min) return `${name} قصير جدًا`;
        if (trimmed.length > max) return `${name} طويل جدًا (الحد ${max})`;
        if (!ARABIC_PATTERN.test(trimmed)) return 'يرجى كتابة المحتوى باللغة العربية فقط';
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Form Submission
    // ═══════════════════════════════════════════════════════════════════
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearStatus();

        // Cooldown check
        const now = Date.now();
        if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
            const remaining = Math.ceil((SUBMIT_COOLDOWN_MS - (now - lastSubmitTime)) / 1000);
            showStatus(`يرجى الانتظار ${remaining} ثانية`, 'error');
            return;
        }

        // Run client validations
        let hasError = false;

        const nameErr = validateInput(nameInput.value, 'الاسم', 3, 100, true);
        if (nameErr) { showFieldError(elements.name.error, nameErr); hasError = true; }

        const bioErr = validateInput(bioInput.value, 'النبذة', 3, 1000, true);
        if (bioErr) { showFieldError(elements.bio.error, bioErr); hasError = true; }

        const traitsErr = validateInput(traitsInput.value, 'الصفات', 3, 500, false);
        if (traitsErr) { showFieldError(elements.traits.error, traitsErr); hasError = true; }

        const charityErr = validateInput(charityInput.value, 'الصدقة', 3, 1000, false);
        if (charityErr) { showFieldError(elements.charity.error, charityErr); hasError = true; }

        const storyErr = validateInput(storyInput.value, 'المواقف', 3, 2000, false);
        if (storyErr) { showFieldError(elements.story.error, storyErr); hasError = true; }

        if (hasError) return;

        // Build Payload
        const externalLinks = getExternalLinks();

        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الإرسال...';

        try {
            const response = await fetch(`${API_BASE}/api/memory/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deceased_name: nameInput.value.trim(),
                    relation: relationInput.value.trim() || null,
                    biography: bioInput.value.trim(),
                    good_traits: traitsInput.value.trim() || null,
                    ongoing_charity: charityInput.value.trim() || null,
                    external_links: externalLinks,
                    story: storyInput.value.trim() || null
                }),
            });

            const result = await response.json();

            if (result.success && result.slug) {
                lastSubmitTime = Date.now();
                showStatus('تم إنشاء الصفحة بنجاح! ستتم مراجعتها من قبل الإدارة قريباً بحول الله.', 'success');
                form.reset();
                linksContainer.innerHTML = ''; // clear links
                Object.values(elements).forEach(item => {
                    if (item.count) item.count.textContent = `0 / ${item.max}`;
                });
                updateAddLinkBtn();

                setTimeout(() => {
                    window.location.href = `/memory/${result.slug}`;
                }, 2000);
            } else {
                showStatus(result.message || 'حدث خطأ. يرجى المحاولة لاحقًا.', 'error');
            }
        } catch (err) {
            showStatus('فشل الاتصال بالخادم. يرجى المحاولة لاحقًا.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إنشاء صفحة صدقة جارية';
        }
    });
})();
