/**
 * On-demand Google Font loading for the poster designer (see #112).
 *
 * Amiri + Cairo ship with the page; Tajawal / Reem Kufi / IBM Plex Sans
 * Arabic load only when first selected, then await document.fonts so the
 * canvas never bakes fallback glyphs into preview or export.
 */

const FONT_CSS_URLS = {
    Tajawal: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap',
    'Reem Kufi': 'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;600;700&display=swap',
    'IBM Plex Sans Arabic': 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap',
};

// Representative weights per family (must cover canvas usage).
const FONT_LOAD_SPECS = {
    Tajawal: ['400 20px "Tajawal"', '700 20px "Tajawal"'],
    'Reem Kufi': ['400 20px "Reem Kufi"', '600 20px "Reem Kufi"'],
    'IBM Plex Sans Arabic': ['400 20px "IBM Plex Sans Arabic"', '700 20px "IBM Plex Sans Arabic"'],
};

const loadedStylesheets = new Set();
const pendingLoads = new Map();

function injectStylesheet(family) {
    if (loadedStylesheets.has(family)) return;
    loadedStylesheets.add(family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_CSS_URLS[family];
    document.head.appendChild(link);
}

/**
 * @param {string} family
 * @returns {Promise<void>} resolves when the family is ready to draw.
 */
export function ensureFontFamilyLoaded(family) {
    if (!FONT_CSS_URLS[family]) return Promise.resolve();
    if (pendingLoads.has(family)) return pendingLoads.get(family);
    const promise = (async () => {
        injectStylesheet(family);
        try {
            await Promise.all(
                (FONT_LOAD_SPECS[family] || []).map((spec) => document.fonts.load(spec)),
            );
            await document.fonts.ready;
        } catch (_err) {
            // Offline or blocked fonts: canvas falls back gracefully.
        }
    })();
    pendingLoads.set(family, promise);
    return promise;
}
