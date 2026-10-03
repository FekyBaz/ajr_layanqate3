/**
 * Mobile navigation helper — accessible toggle for the site header menu.
 *
 * Features:
 * - Click toggles `.is-open` + synced `aria-expanded`
 * - `Escape` closes the menu and returns focus to the toggle button
 * - Focuses the first menu link on open (keyboard users)
 * - Returns focus to the toggle on close
 * - Closes on outside click and on resize to desktop width
 * - Updates Arabic `aria-label` (فتح/إغلاق القائمة)
 *
 * Usable as classic script (`window.initMobileNav`) and as ES module.
 *
 * @param {Object} [options]
 * @param {string} [options.toggleId='menuToggle']
 * @param {string} [options.menuId='mainMenu']
 * @param {number} [options.desktopMinWidth=769]
 * @returns {{ destroy: () => void } | undefined}
 */
(function (global) {
    'use strict';

    const DEFAULT_TOGGLE_ID = 'menuToggle';
    const DEFAULT_MENU_ID = 'mainMenu';
    const LABEL_OPEN = 'فتح القائمة';
    const LABEL_CLOSE = 'إغلاق القائمة';

    function initMobileNav(options) {
        const opts = options || {};
        const toggleId = opts.toggleId || DEFAULT_TOGGLE_ID;
        const menuId = opts.menuId || DEFAULT_MENU_ID;
        const desktopMinWidth = opts.desktopMinWidth || 769;

        const toggle = document.getElementById(toggleId);
        const menu = document.getElementById(menuId);
        if (!toggle || !menu) return undefined;

        // Ensure initial accessible state
        if (!toggle.hasAttribute('aria-expanded')) {
            toggle.setAttribute('aria-expanded', 'false');
        }
        if (!toggle.hasAttribute('aria-label')) {
            toggle.setAttribute('aria-label', LABEL_OPEN);
        }
        if (!toggle.hasAttribute('aria-controls')) {
            toggle.setAttribute('aria-controls', menu.id || menuId);
        }

        let lastFocusedBeforeOpen = null;

        function isOpen() {
            return toggle.getAttribute('aria-expanded') === 'true';
        }

        function focusFirstLink() {
            const firstLink = menu.querySelector('a[href]');
            if (firstLink) firstLink.focus();
        }

        function openMenu() {
            lastFocusedBeforeOpen = document.activeElement;
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', LABEL_CLOSE);
            menu.classList.add('is-open');
        }

        function closeMenu(returnFocus) {
            if (!isOpen()) return;
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', LABEL_OPEN);
            menu.classList.remove('is-open');
            if (returnFocus) {
                const target = lastFocusedBeforeOpen === document.body ? toggle : (toggle || lastFocusedBeforeOpen);
                if (target && typeof target.focus === 'function') target.focus();
                else toggle.focus();
            }
        }

        function onToggleClick() {
            if (isOpen()) {
                closeMenu(false);
            } else {
                openMenu();
                focusFirstLink();
            }
        }

        function onDocumentKeydown(event) {
            if (event.key === 'Escape' || event.key === 'Esc') {
                if (isOpen()) {
                    event.stopPropagation();
                    closeMenu(true);
                }
            }
        }

        function onDocumentClick(event) {
            if (!isOpen()) return;
            const target = event.target;
            if (toggle.contains(target) || menu.contains(target)) return;
            closeMenu(false);
        }

        function onResize() {
            if (window.innerWidth >= desktopMinWidth && isOpen()) {
                closeMenu(false);
            }
        }

        toggle.addEventListener('click', onToggleClick);
        document.addEventListener('keydown', onDocumentKeydown);
        document.addEventListener('click', onDocumentClick);
        window.addEventListener('resize', onResize);

        return {
            destroy() {
                toggle.removeEventListener('click', onToggleClick);
                document.removeEventListener('keydown', onDocumentKeydown);
                document.removeEventListener('click', onDocumentClick);
                window.removeEventListener('resize', onResize);
            },
        };
    }

    // Classic script global
    global.initMobileNav = initMobileNav;

    // ESM/CJS interop when bundled
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { initMobileNav };
    }
})(globalThis);
