/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Create Memory Form Script (create-memory.js)
 * Handles memory creation: character limits,
 * client-side rate limit indicator, form submission.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════
    // Single source: lib/config.js (loaded before this script)
    const API_BASE = window.AppConfig.API_BASE;


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
            clearFieldError(item.error, item.input);
        });
    });

    function showFieldError(el, message, input) {
        if (!el) return;
        el.textContent = message;
        el.classList.add('visible');
        if (input) {
            input.classList.add('is-invalid');
            input.setAttribute('aria-invalid', 'true');
            const describedBy = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
            if (el.id && !describedBy.includes(el.id)) {
                describedBy.push(el.id);
                input.setAttribute('aria-describedby', describedBy.join(' '));
            }
        }
    }

    function clearFieldError(el, input) {
        if (!el) return;
        el.textContent = '';
        el.classList.remove('visible');
        if (input) {
            input.classList.remove('is-invalid');
            input.removeAttribute('aria-invalid');
        }
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
        const errors = [];
        const rows = linksContainer.querySelectorAll('.link-row');
        rows.forEach((row, idx) => {
            const title = row.querySelector('.link-title').value.trim();
            const url = row.querySelector('.link-url').value.trim();
            if (!url) return; // Empty rows are ignored

            try {
                const parsed = new URL(url);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    errors.push(`الرابط ${idx + 1}: يجب أن يبدأ بـ http:// أو https://`);
                    return;
                }
                if (!parsed.hostname || parsed.hostname.length < 3) {
                    errors.push(`الرابط ${idx + 1}: عنوان الموقع غير صالح`);
                    return;
                }
                links.push({ title, url: parsed.href });
            } catch (e) {
                errors.push(`الرابط ${idx + 1}: رابط غير صالح "${url.substring(0, 40)}"`);
            }
        });
        return { links: links.length ? links : null, errors };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Validation
    // ═══════════════════════════════════════════════════════════════════
    function validateInput(value, name, min, max, required = false) {
        const trimmed = value.trim();
        if (!trimmed) return required ? `${name} مطلوب` : null;
        if (trimmed.length < min) return `${name} قصير جدًا`;
        if (trimmed.length > max) return `${name} طويل جدًا (الحد ${max})`;
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Form Submission
    // ═══════════════════════════════════════════════════════════════════
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearStatus();
        Object.values(elements).forEach(item => clearFieldError(item.error, item.input));
        clearFieldError(linksError);

        // Cooldown check
        const now = Date.now();
        if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
            const remaining = Math.ceil((SUBMIT_COOLDOWN_MS - (now - lastSubmitTime)) / 1000);
            showStatus(`يرجى الانتظار ${remaining} ثانية`, 'error');
            return;
        }

        // Run client validations
        let hasError = false;
        let firstInvalid = null;
        const markInvalid = (errorEl, message, input) => {
            showFieldError(errorEl, message, input);
            hasError = true;
            if (input && !firstInvalid) firstInvalid = input;
        };

        const nameErr = validateInput(nameInput.value, 'الاسم', 3, 100, true);
        if (nameErr) { markInvalid(elements.name.error, nameErr, nameInput); }

        const bioErr = validateInput(bioInput.value, 'النبذة', 3, 1000, false);
        if (bioErr) { markInvalid(elements.bio.error, bioErr, bioInput); }

        const traitsErr = validateInput(traitsInput.value, 'الصفات', 3, 500, false);
        if (traitsErr) { markInvalid(elements.traits.error, traitsErr, traitsInput); }

        const charityErr = validateInput(charityInput.value, 'الصدقة', 3, 1000, false);
        if (charityErr) { markInvalid(elements.charity.error, charityErr, charityInput); }

        const storyErr = validateInput(storyInput.value, 'المواقف', 3, 2000, false);
        if (storyErr) { markInvalid(elements.story.error, storyErr, storyInput); }

        // Build Payload
        const linkResult = getExternalLinks();
        if (linkResult.errors.length > 0) {
            showFieldError(linksError, linkResult.errors.join('\n'));
            hasError = true;
            if (!firstInvalid) {
                firstInvalid = linksContainer.querySelector('.link-url') || addLinkBtn;
            }
        }

        if (hasError) {
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        submitBtn.disabled = true;
        const submitBtnOriginal = submitBtn.innerHTML;
        submitBtn.textContent = 'جاري الإرسال...';

        try {
            const response = await fetch(`${API_BASE}/api/memory/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deceased_name: nameInput.value.trim(),
                    relation: relationInput.value.trim() || null,
                    biography: bioInput.value.trim() || null,
                    good_traits: traitsInput.value.trim() || null,
                    ongoing_charity: charityInput.value.trim() || null,
                    external_links: linkResult.links,
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
            submitBtn.innerHTML = submitBtnOriginal;
        }
    });
})();
