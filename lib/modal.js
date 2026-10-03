/**
 * Shared accessible modal helper (see issue #66).
 *
 * - Stores the trigger element and restores focus on close
 * - Moves focus inside the modal on open ([data-autofocus] or first focusable)
 * - Traps Tab / Shift+Tab inside the open modal
 * - Single Escape handler that only closes the topmost open modal
 * - Locks body scroll while any modal is open
 * - Marks background content inert/aria-hidden while open (with fallback)
 *
 * Usable as classic script (`window.ModalHelper`) — no build step.
 */
(function (global) {
    'use strict';

    const openStack = [];

    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    function getFocusable(modal) {
        const nodes = modal.querySelectorAll(FOCUSABLE_SELECTOR);
        return Array.prototype.filter.call(nodes, (el) => {
            if (el.hasAttribute('disabled')) return false;
            if (el.getAttribute('aria-hidden') === 'true') return false;
            // offsetParent is null for fixed-position ancestors in some layouts;
            // rely on computed visibility instead of geometry.
            const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
            if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
            return true;
        });
    }

    function focusInitial(modal) {
        const autofocusEl = modal.querySelector('[data-autofocus]');
        if (autofocusEl && typeof autofocusEl.focus === 'function') {
            autofocusEl.focus();
            return;
        }
        const focusable = getFocusable(modal);
        if (focusable.length > 0) {
            focusable[0].focus();
            return;
        }
        if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
        modal.focus();
    }

    function setBackgroundInert(activeModal, inert) {
        const bodyChildren = document.body ? Array.prototype.slice.call(document.body.children) : [];
        bodyChildren.forEach((child) => {
            if (child === activeModal) return;
            // Skip live-region/script helpers
            if (child.tagName === 'SCRIPT') return;
            try {
                if (inert) {
                    if ('inert' in child) child.inert = true;
                    child.setAttribute('aria-hidden', 'true');
                } else {
                    if ('inert' in child) child.inert = false;
                    child.removeAttribute('aria-hidden');
                }
            } catch (_err) {
                // Never break modal behaviour because of inert support
            }
        });
        // The modal itself must stay exposed to assistive tech
        try {
            activeModal.removeAttribute('aria-hidden');
        } catch (_err2) {
            // ignore
        }
    }

    function lockScroll() {
        document.body.style.overflow = 'hidden';
    }

    function unlockScrollIfNoneOpen() {
        if (openStack.length === 0) document.body.style.overflow = '';
    }

    function findEntry(modal) {
        for (let i = 0; i < openStack.length; i += 1) {
            if (openStack[i].modal === modal) return i;
        }
        return -1;
    }

    /**
     * @param {HTMLElement} modal
     * @param {HTMLElement|null} [triggerEl]
     * @param {Object} [options]
     * @param {boolean} [options.resetScroll=true]
     * @param {string} [options.scrollSelector='.yaseen-modal__body']
     */
    function openModal(modal, triggerEl, options) {
        if (!modal) return;
        if (findEntry(modal) !== -1) {
            focusInitial(modal);
            return;
        }
        const opts = options || {};
        openStack.push({ modal, trigger: triggerEl || document.activeElement || null });
        modal.classList.remove('hidden');
        lockScroll();
        setBackgroundInert(modal, true);
        if (opts.resetScroll !== false) {
            const scrollEl = opts.scrollSelector
                ? modal.querySelector(opts.scrollSelector)
                : modal.querySelector('.yaseen-modal__body');
            if (scrollEl) scrollEl.scrollTop = 0;
        }
        focusInitial(modal);
    }

    /**
     * @param {HTMLElement} modal
     * @param {Object} [options]
     * @param {boolean} [options.returnFocus=true]
     */
    function closeModal(modal, options) {
        if (!modal) return;
        const idx = findEntry(modal);
        const opts = options || {};
        const shouldReturnFocus = opts.returnFocus !== false;
        let trigger = null;
        if (idx !== -1) {
            trigger = openStack[idx].trigger;
            openStack.splice(idx, 1);
        }
        modal.classList.add('hidden');
        setBackgroundInert(modal, false);
        unlockScrollIfNoneOpen();
        if (shouldReturnFocus) {
            const target = trigger && document.contains(trigger) ? trigger : null;
            if (target && typeof target.focus === 'function') target.focus();
        }
    }

    function isModalOpen(modal) {
        return findEntry(modal) !== -1;
    }

    function onKeydown(event) {
        if (openStack.length === 0) return;
        const top = openStack[openStack.length - 1];
        const { modal } = top;
        if (event.key === 'Escape' || event.key === 'Esc') {
            event.stopPropagation();
            closeModal(modal);
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = getFocusable(modal);
        if (focusable.length === 0) {
            event.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    if (typeof document !== 'undefined' && !document.__modalHelperBound) {
        document.addEventListener('keydown', onKeydown, true);
        document.__modalHelperBound = true;
    }

    const api = { open: openModal, close: closeModal, isOpen: isModalOpen };
    global.ModalHelper = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(globalThis);
