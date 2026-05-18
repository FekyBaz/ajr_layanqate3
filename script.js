/**
 * ═══════════════════════════════════════════════════════════════════════════
 * أجر لا ينقطع - Endless Reward
 * Form Handling & Validation Script
 * 
 * Features:
 * - Client-side validation
 * - Input sanitization (no HTML/scripts)
 * - Character counting
 * - Backend API integration
 * - Rate limiting (client + server)
 * - Accessible error handling
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ⚠️ PRODUCTION API URL CONFIGURATION
     * ═══════════════════════════════════════════════════════════════════════
     * This URL must point to your production backend API.
     * 
     * Examples:
     * - Railway:  'https://your-app.railway.app'
     * - Render:   'https://your-app.onrender.com'
     * - Vercel:   'https://your-api.vercel.app'
     * - Custom:   'https://api.yourdomain.com'
     * 
     * Leave empty if frontend and backend are on the same domain.
     * ═══════════════════════════════════════════════════════════════════════
     */
    const PRODUCTION_API_URL = ''; // ← Change this to your production backend URL

    const isProduction = !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1');

    const CONFIG = {
        API_BASE_URL: isProduction ? PRODUCTION_API_URL : 'http://localhost:8888',
        API_ENDPOINT: '/api/submit',
    };

    // ═══════════════════════════════════════════════════════════════════════
    // DOM Elements
    // ═══════════════════════════════════════════════════════════════════════
    const form = document.getElementById('submission-form');
    const contentType = document.getElementById('content-type');
    const content = document.getElementById('content');
    const consent = document.getElementById('consent');
    const submitBtn = document.getElementById('submit-btn');
    const charCount = document.getElementById('char-count');
    const successMessage = document.getElementById('success-message');
    const resetFormBtn = document.getElementById('reset-form');
    const submitTransition = document.getElementById('submit-transition');

    // Error elements
    const contentTypeError = document.getElementById('content-type-error');
    const contentError = document.getElementById('content-error');
    const consentError = document.getElementById('consent-error');

    // Guard: only run form logic on pages that have the submission form
    if (!form) return;

    // ═══════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════
    const MAX_CONTENT_LENGTH = 1000; // Reduced to match backend limit
    const MIN_CONTENT_LENGTH = 3; // Match backend minimum
    let isSubmitting = false;

    // Client-side rate limiting (supplementary to server-side)
    const RATE_LIMIT_KEY = 'ajr_submissions';
    const RATE_LIMIT_MAX = 10; // Match backend limit
    const RATE_LIMIT_WINDOW = 86400000; // 24 hours in milliseconds

    // ═══════════════════════════════════════════════════════════════════════
    // Arabic Error Messages
    // ═══════════════════════════════════════════════════════════════════════
    const ERRORS = {
        contentTypeRequired: 'يرجى اختيار نوع المحتوى قبل الإرسال',
        contentRequired: 'يرجى كتابة ذكر قبل الإرسال',
        contentTooShort: `أضف قليلًا من التفصيل (على الأقل ${MIN_CONTENT_LENGTH} أحرف)`,
        contentTooLong: `النص طويل قليلًا، حاول الاختصار بلطف (حتى ${MAX_CONTENT_LENGTH} حرف)`,
        consentRequired: 'يرجى تأكيد التعهد قبل الإرسال',
        rateLimited: 'لقد تجاوزت الحد المسموح من المشاركات. يرجى المحاولة لاحقًا.',
        networkError: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
        submissionFailed: 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.'
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Utility Functions
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Sanitizes input by removing HTML tags and script content
     * @param {string} input - The raw input string
     * @returns {string} - Sanitized string
     */
    function sanitizeInput(input) {
        if (typeof input !== 'string') return '';

        let sanitized = input.trim();

        // Strip HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');

        // Remove dangerous URL schemes
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.replace(/vbscript:/gi, '');
        sanitized = sanitized.replace(/data:/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=/gi, '');

        // Normalize whitespace (keep newlines for readability)
        sanitized = sanitized.replace(/[ \t]+/g, ' ');
        sanitized = sanitized.trim();

        return sanitized;
    }

    /**
     * Checks client-side rate limiting for submissions
     * Note: Server-side rate limiting is the primary protection
     * @returns {boolean} - True if within rate limit
     */
    function checkRateLimit() {
        try {
            const data = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}');
            const now = Date.now();

            // Clean old entries
            if (data.timestamp && (now - data.timestamp > RATE_LIMIT_WINDOW)) {
                localStorage.removeItem(RATE_LIMIT_KEY);
                return true;
            }

            return !data.count || data.count < RATE_LIMIT_MAX;
        } catch (e) {
            return true; // If storage fails, allow submission (server will handle)
        }
    }

    /**
     * Updates the client-side rate limit counter
     */
    function updateRateLimit() {
        try {
            const data = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}');
            const now = Date.now();

            if (!data.timestamp || (now - data.timestamp > RATE_LIMIT_WINDOW)) {
                localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({
                    count: 1,
                    timestamp: now
                }));
            } else {
                data.count = (data.count || 0) + 1;
                localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
            }
        } catch (e) {
            // Silently fail if storage is not available
        }
    }

    /**
     * Shows an error message for a field
     * @param {HTMLElement} field - The form field
     * @param {HTMLElement} errorEl - The error message element
     * @param {string} message - The error message
     */
    function showError(field, errorEl, message) {
        if (field) {
            field.classList.add('is-invalid');
            field.setAttribute('aria-invalid', 'true');
        }
        if (errorEl) {
            errorEl.textContent = message;
        }
    }

    /**
     * Clears an error message for a field
     * @param {HTMLElement} field - The form field
     * @param {HTMLElement} errorEl - The error message element
     */
    function clearError(field, errorEl) {
        if (field) {
            field.classList.remove('is-invalid');
            field.removeAttribute('aria-invalid');
        }
        if (errorEl) {
            errorEl.textContent = '';
        }
    }

    /**
     * Clears all form errors
     */
    function clearAllErrors() {
        clearError(contentType, contentTypeError);
        clearError(content, contentError);
        clearError(null, consentError);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Validation Functions
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Validates the content type field
     * @returns {boolean}
     */
    function validateContentType() {
        if (!contentType.value) {
            showError(contentType, contentTypeError, ERRORS.contentTypeRequired);
            return false;
        }
        clearError(contentType, contentTypeError);
        return true;
    }

    /**
     * Validates the content field
     * @returns {boolean}
     */
    function validateContent() {
        const value = content.value.trim();

        if (!value) {
            showError(content, contentError, ERRORS.contentRequired);
            return false;
        }

        if (value.length < MIN_CONTENT_LENGTH) {
            showError(content, contentError, ERRORS.contentTooShort);
            return false;
        }

        if (value.length > MAX_CONTENT_LENGTH) {
            showError(content, contentError, ERRORS.contentTooLong);
            return false;
        }

        clearError(content, contentError);
        return true;
    }

    /**
     * Validates the consent checkbox
     * @returns {boolean}
     */
    function validateConsent() {
        if (!consent.checked) {
            showError(null, consentError, ERRORS.consentRequired);
            return false;
        }
        clearError(null, consentError);
        return true;
    }

    /**
     * Validates the entire form
     * @returns {boolean}
     */
    function validateForm() {
        const isContentTypeValid = validateContentType();
        const isContentValid = validateContent();
        const isConsentValid = validateConsent();

        return isContentTypeValid && isContentValid && isConsentValid;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // API Communication
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Submits data to the backend API
     * @param {Object} data - The submission data
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async function submitToAPI(data) {
        const url = `${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINT}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        // Handle rate limiting from server
        if (response.status === 429) {
            throw new Error('RATE_LIMITED');
        }

        // Handle validation errors
        if (response.status === 400) {
            throw new Error(result.message || 'VALIDATION_ERROR');
        }

        // Handle server errors
        if (!response.ok) {
            throw new Error(result.message || 'SERVER_ERROR');
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Form Submission
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Handles form submission
     * @param {Event} e - The submit event
     */
    async function handleSubmit(e) {
        e.preventDefault();

        if (isSubmitting) {
            return;
        }

        // Clear previous errors
        clearAllErrors();

        // Check client-side rate limiting (supplementary check)
        if (!checkRateLimit()) {
            showError(null, contentError, ERRORS.rateLimited);
            return;
        }

        // Validate form
        if (!validateForm()) {
            // Focus the first invalid field
            const firstInvalid = form.querySelector('.is-invalid');
            if (firstInvalid) {
                firstInvalid.focus();
            }
            return;
        }

        // Show loading state
        isSubmitting = true;
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        if (submitTransition) {
            submitTransition.hidden = false;
        }

        // Prepare data for API - use backend field names
        const apiData = {
            message: sanitizeInput(content.value),
            content_type: contentType.value,
        };

        try {
            // Submit to backend API
            const result = await submitToAPI(apiData);

            if (result.success) {
                // Update client-side rate limiting
                updateRateLimit();
                sessionStorage.setItem('ajr_submission_pending_review', '1');
                await new Promise(resolve => setTimeout(resolve, 500));
                window.location.href = '/community.html?submitted=1';
            } else {
                // Show error message from server
                showError(null, contentError, result.message || ERRORS.submissionFailed);
            }

        } catch (error) {
            console.error('Submission error:', error.message);

            // Handle specific error types
            if (error.message === 'RATE_LIMITED') {
                showError(null, contentError, ERRORS.rateLimited);
            } else if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
                // Network error
                showError(null, contentError, ERRORS.networkError);
            } else {
                // Server returned an error message
                showError(null, contentError, error.message || ERRORS.submissionFailed);
            }
        } finally {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
            isSubmitting = false;
            if (submitTransition) {
                submitTransition.hidden = true;
            }
        }
    }

    /**
     * Resets the form to initial state
     */
    function resetForm() {
        form.reset();
        form.hidden = false;
        successMessage.hidden = true;
        clearAllErrors();
        updateCharCount();
        if (submitTransition) {
            submitTransition.hidden = true;
        }
        contentType.focus();
    }

    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Updates the character count display
     */
    function updateCharCount() {
        const count = content.value.length;

        if (charCount) {
            charCount.textContent = count;
            charCount.classList.remove('is-near-limit', 'is-at-limit');

            if (count >= MAX_CONTENT_LENGTH) {
                charCount.classList.add('is-at-limit');
            } else if (count >= MAX_CONTENT_LENGTH * 0.85) {
                charCount.classList.add('is-near-limit');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Event Listeners
    // ═══════════════════════════════════════════════════════════════════════

    // Form submission
    form.addEventListener('submit', handleSubmit);

    // Reset form button
    resetFormBtn.addEventListener('click', resetForm);

    // Character counting
    if (content) {
        content.addEventListener('input', updateCharCount);
    }

    // Real-time validation on blur
    contentType.addEventListener('blur', validateContentType);
    content.addEventListener('blur', validateContent);
    consent.addEventListener('change', validateConsent);

    // Clear errors on input
    contentType.addEventListener('change', function () {
        clearError(contentType, contentTypeError);
    });

    content.addEventListener('input', function () {
        if (content.classList.contains('is-invalid')) {
            clearError(content, contentError);
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════════

    // Initialize character count
    updateCharCount();

    // Update the maxlength attribute to match backend
    content.setAttribute('maxlength', MAX_CONTENT_LENGTH);

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Console message for developers
    console.log('%cأجر لا ينقطع', 'font-size: 20px; font-weight: bold;');
    console.log('%cEndless Reward - Sadaqah Jariyah Platform', 'font-size: 14px; color: #27ae60;');

})();
