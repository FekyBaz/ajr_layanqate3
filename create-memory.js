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
    const messageInput = document.getElementById('memory-message');
    const submitBtn = document.getElementById('submit-btn');
    const formStatus = document.getElementById('form-status');

    const nameCharCount = document.getElementById('name-char-count');
    const messageCharCount = document.getElementById('message-char-count');
    const nameError = document.getElementById('name-error');
    const messageError = document.getElementById('message-error');

    // ═══════════════════════════════════════════════════════════════════
    // Character Counters
    // ═══════════════════════════════════════════════════════════════════
    nameInput.addEventListener('input', () => {
        const len = nameInput.value.length;
        nameCharCount.textContent = `${len} / ${NAME_MAX_LENGTH}`;
        nameCharCount.classList.toggle('over-limit', len > NAME_MAX_LENGTH);
        clearFieldError(nameError);
    });

    messageInput.addEventListener('input', () => {
        const len = messageInput.value.length;
        messageCharCount.textContent = `${len} / ${MESSAGE_MAX_LENGTH}`;
        messageCharCount.classList.toggle('over-limit', len > MESSAGE_MAX_LENGTH);
        clearFieldError(messageError);
    });

    // ═══════════════════════════════════════════════════════════════════
    // Validation
    // ═══════════════════════════════════════════════════════════════════
    function validateName(value) {
        const trimmed = value.trim();
        if (!trimmed) return 'اسم المتوفى مطلوب';
        if (trimmed.length > NAME_MAX_LENGTH) return `الاسم طويل جدًا (الحد: ${NAME_MAX_LENGTH} حرف)`;
        // Name can contain Arabic + spaces + common punctuation
        return null;
    }

    function validateMessage(value) {
        const trimmed = value.trim();
        if (!trimmed) return 'الرسالة مطلوبة';
        if (trimmed.length < MESSAGE_MIN_LENGTH) return 'الرسالة قصيرة جدًا';
        if (trimmed.length > MESSAGE_MAX_LENGTH) return `الرسالة طويلة جدًا (الحد: ${MESSAGE_MAX_LENGTH} حرف)`;
        if (!ARABIC_PATTERN.test(trimmed)) return 'يرجى كتابة المحتوى باللغة العربية فقط';
        return null;
    }

    function showFieldError(el, message) {
        el.textContent = message;
        el.classList.add('visible');
    }

    function clearFieldError(el) {
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
    // Form Submission
    // ═══════════════════════════════════════════════════════════════════
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearStatus();

        // Client-side cooldown
        const now = Date.now();
        if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
            const remaining = Math.ceil((SUBMIT_COOLDOWN_MS - (now - lastSubmitTime)) / 1000);
            showStatus(`يرجى الانتظار ${remaining} ثانية`, 'error');
            return;
        }

        // Validate
        const nameErr = validateName(nameInput.value);
        const msgErr = validateMessage(messageInput.value);

        if (nameErr) {
            showFieldError(nameError, nameErr);
        }
        if (msgErr) {
            showFieldError(messageError, msgErr);
        }
        if (nameErr || msgErr) return;

        // Disable button
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الإرسال...';

        try {
            const response = await fetch(`${API_BASE}/api/memory/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deceased_name: nameInput.value.trim(),
                    relation: relationInput.value.trim() || null,
                    message: messageInput.value.trim(),
                }),
            });

            const result = await response.json();

            if (result.success && result.slug) {
                lastSubmitTime = Date.now();
                showStatus('تم إنشاء الصفحة بنجاح! ستتم مراجعتها قريبًا إن شاء الله.', 'success');
                form.reset();
                nameCharCount.textContent = `0 / ${NAME_MAX_LENGTH}`;
                messageCharCount.textContent = `0 / ${MESSAGE_MAX_LENGTH}`;

                // Optionally redirect after a delay
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
