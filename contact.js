(function () {
    'use strict';

    // Single source: lib/config.js (loaded before this script)
    const API_BASE = window.AppConfig.API_BASE;

    const form = document.getElementById('contactForm');
    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const messageInput = document.getElementById('contact-message');
    const msgCount = document.getElementById('msg-count');
    const messageError = document.getElementById('message-error');
    const submitBtn = document.getElementById('contactSubmit');
    const successEl = document.getElementById('contactSuccess');

    const emailError = document.getElementById('email-error');

    if (!form) return;

    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function setFieldError(input, errorEl, message) {
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('visible');
        }
        if (input) {
            input.classList.add('is-invalid');
            input.setAttribute('aria-invalid', 'true');
        }
    }

    function clearFieldError(input, errorEl) {
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
        }
        if (input) {
            input.classList.remove('is-invalid');
            input.removeAttribute('aria-invalid');
        }
    }

    messageInput.addEventListener('input', () => {
        msgCount.textContent = messageInput.value.length;
        if (messageInput.value.trim().length >= 10) {
            clearFieldError(messageInput, messageError);
        }
    });

    emailInput.addEventListener('input', () => {
        const value = emailInput.value.trim();
        if (value === '' || EMAIL_PATTERN.test(value)) {
            clearFieldError(emailInput, emailError);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldError(messageInput, messageError);
        clearFieldError(emailInput, emailError);

        let firstInvalid = null;

        const email = emailInput.value.trim();
        if (email !== '' && !EMAIL_PATTERN.test(email)) {
            setFieldError(emailInput, emailError, 'صيغة البريد الإلكتروني غير صحيحة');
            firstInvalid = firstInvalid || emailInput;
        }

        const message = messageInput.value.trim();
        if (message.length < 10) {
            setFieldError(messageInput, messageError, 'الرسالة قصيرة جدًا (الأدنى 10 أحرف)');
            firstInvalid = firstInvalid || messageInput;
        }

        if (firstInvalid) {
            firstInvalid.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الإرسال...';

        try {
            const response = await fetch(`${API_BASE}/api/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameInput.value.trim() || null,
                    email: emailInput.value.trim() || null,
                    message: message,
                }),
            });

            const result = await response.json();

            if (result.success) {
                form.style.display = 'none';
                successEl.classList.add('visible');
            } else {
                setFieldError(messageInput, messageError, result.message || 'حدث خطأ. يرجى المحاولة لاحقًا.');
                messageInput.focus();
                submitBtn.disabled = false;
                submitBtn.textContent = 'إرسال الرسالة';
            }
        } catch (err) {
            setFieldError(messageInput, messageError, 'حدث خطأ في الاتصال. يرجى المحاولة لاحقًا.');
            messageInput.focus();
            submitBtn.disabled = false;
            submitBtn.textContent = 'إرسال الرسالة';
        }
    });
})();
