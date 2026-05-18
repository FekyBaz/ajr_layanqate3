(function () {
    'use strict';

    const PRODUCTION_API_URL = '';
    const isProduction = !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1');
    const API_BASE = isProduction ? PRODUCTION_API_URL : 'http://localhost:8888';

    const form = document.getElementById('contactForm');
    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const messageInput = document.getElementById('contact-message');
    const msgCount = document.getElementById('msg-count');
    const messageError = document.getElementById('message-error');
    const submitBtn = document.getElementById('contactSubmit');
    const successEl = document.getElementById('contactSuccess');

    if (!form) return;

    messageInput.addEventListener('input', () => {
        msgCount.textContent = messageInput.value.length;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageError.classList.remove('visible');

        const message = messageInput.value.trim();
        if (message.length < 10) {
            messageError.textContent = 'الرسالة قصيرة جدًا (الأدنى 10 أحرف)';
            messageError.classList.add('visible');
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
                messageError.textContent = result.message || 'حدث خطأ. يرجى المحاولة لاحقًا.';
                messageError.classList.add('visible');
                submitBtn.disabled = false;
                submitBtn.textContent = 'إرسال الرسالة';
            }
        } catch (err) {
            messageError.textContent = 'حدث خطأ في الاتصال. يرجى المحاولة لاحقًا.';
            messageError.classList.add('visible');
            submitBtn.disabled = false;
            submitBtn.textContent = 'إرسال الرسالة';
        }
    });
})();
