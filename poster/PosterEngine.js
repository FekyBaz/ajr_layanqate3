/**
 * أجر لا ينقطع - PosterEngine
 * The central orchestrator that coordinates UI binding, high-DPI viewport setups,
 * dynamic URL query loading, and animation rendering loops.
 */

import { ThemeManager } from './ThemeManager.js';
import { TemplateSystem } from './TemplateSystem.js';
import { ExportEngine } from './ExportEngine.js';
import { ShareSystem } from './ShareSystem.js';
import { MotionPreview } from './MotionPreview.js';

export class PosterEngine {
    constructor() {
        // 1. Initialize State Parameters
        this.activeThemeId = 'night-spiritual';
        this.ratio = 'square';
        this.fontSizeSliderValue = 38;
        this.text = '';
        
        this.startTime = Date.now();
        this.pausedTimeOffset = 0;
        this.isActive = true;
        this.needsRedraw = true;

        this.motionPreview = new MotionPreview();

        // 2. Cache DOM Elements
        this.cacheDOMElements();

        // 3. Preload State from URL Query Parameters
        this.preloadFromQuery();

        // 4. Bind UI Event Observers
        this.bindEvents();

        // 5. Setup Viewport Dimensions and Trigger Rendering Loop
        this.initViewport();
        this.startRenderingLoop();
    }

    /**
     * Cache page elements to guarantee fast local interactions.
     */
    cacheDOMElements() {
        this.canvasViewport = document.getElementById('canvasViewport');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.exportCanvas = document.getElementById('exportCanvas');

        this.textInput = document.getElementById('posterText');
        this.charCountSpan = document.getElementById('charCount');
        this.fontSelect = document.getElementById('fontSelect');
        this.fontSizeSlider = document.getElementById('fontSizeSlider');
        this.fontSizeValueSpan = document.getElementById('fontSizeValue');
        
        this.themesContainer = document.getElementById('themesContainer');
        this.ratioSelectors = document.getElementById('ratioSelectors');
        
        this.downloadBtn = document.getElementById('downloadBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.toast = document.getElementById('posterToast');
    }

    /**
     * Parses URL query parameters to pre-populate text inputs.
     */
    preloadFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const textParam = params.get('text');
        const typeParam = params.get('type');

        if (textParam) {
            // Unescape, decode, and trim preloaded content
            this.text = decodeURIComponent(textParam).trim();
            this.textInput.value = this.text;
            this.charCountSpan.textContent = this.text.length;
        } else {
            // Default placeholder to start with a beautiful experience immediately
            this.text = 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ ، سُبْحَانَ اللَّهِ الْعَظِيمِ';
            this.textInput.value = this.text;
            this.charCountSpan.textContent = this.text.length;
        }

        // Pre-select theme if matching type param exists (e.g. green for nature-serenity, dark for premium-gold)
        if (typeParam === 'hadith' || typeParam === 'benefit') {
            this.activeThemeId = 'premium-gold';
        } else if (typeParam === 'dua') {
            this.activeThemeId = 'nature-serenity';
        }
    }

    /**
     * Binds user control updates to render states.
     */
    bindEvents() {
        // Text changes
        this.textInput.addEventListener('input', (e) => {
            this.text = e.target.value;
            this.charCountSpan.textContent = this.text.length;
            this.needsRedraw = true;
        });

        // Font family select
        this.fontSelect.addEventListener('change', () => {
            this.needsRedraw = true;
        });

        // Font size slider adjustments
        this.fontSizeSlider.addEventListener('input', (e) => {
            this.fontSizeSliderValue = parseInt(e.target.value, 10);
            this.fontSizeValueSpan.textContent = `${this.fontSizeSliderValue}px`;
            this.needsRedraw = true;
        });

        // Custom theme cards grid
        this.themesContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.theme-card');
            if (!card) return;

            // Update DOM states
            this.themesContainer.querySelectorAll('.theme-card').forEach(btn => btn.classList.remove('active'));
            card.classList.add('active');

            // Update state variables
            this.activeThemeId = card.dataset.theme;
            
            // Sync default font family if custom select is classical Amiri or default matches
            const theme = ThemeManager.getTheme(this.activeThemeId);
            this.fontSelect.value = theme.fontFamily;

            this.needsRedraw = true;
        });

        // Sizing aspect ratio triggers
        this.ratioSelectors.addEventListener('click', (e) => {
            const btn = e.target.closest('.ratio-btn');
            if (!btn) return;

            this.ratioSelectors.querySelectorAll('.ratio-btn').forEach(card => card.classList.remove('active'));
            btn.classList.add('active');

            this.ratio = btn.dataset.ratio;
            this.canvasViewport.setAttribute('data-ratio', this.ratio);

            // Give the browser client layout sizes time to compute, then resize canvases
            setTimeout(() => this.resizePreviewCanvas(), 100);
        });

        // Download Action
        this.downloadBtn.addEventListener('click', async () => {
            try {
                this.setLoadingState(true, 'جاري تصدير الملف الفني...');
                const theme = this.getCombinedTheme();
                await ExportEngine.downloadPoster(this.exportCanvas, theme, this.text, this.ratio, this.fontSizeSliderValue);
                this.showToast('تم تحميل لوحتك الفنية بنجاح ✨');
            } catch (err) {
                console.error(err);
                this.showToast('عذرًا، حدث خطأ أثناء التصدير 😢');
            } finally {
                this.setLoadingState(false);
            }
        });

        // Share Action
        this.shareBtn.addEventListener('click', async () => {
            try {
                this.setLoadingState(true, 'جاري تحضير اللوحة للمشاركة...');
                const theme = this.getCombinedTheme();
                await ShareSystem.sharePoster(
                    this.exportCanvas,
                    theme,
                    this.text,
                    this.ratio,
                    this.fontSizeSliderValue,
                    (msg) => this.showToast(msg)
                );
            } catch (err) {
                console.error(err);
                this.showToast('فشل تجهيز المشاركة 😢');
            } finally {
                this.setLoadingState(false);
            }
        });

        // Handle page resizing and high-DPI re-computation
        window.addEventListener('resize', () => this.resizePreviewCanvas());

        // Handle visibility cycles (Pauses active animations when tab is backgrounded to protect client devices)
        document.addEventListener('visibilitychange', () => {
            this.isActive = !document.hidden;
            if (this.isActive) {
                this.startTime = Date.now() - this.pausedTimeOffset;
                this.startRenderingLoop();
            } else {
                this.pausedTimeOffset = Date.now() - this.startTime;
            }
        });
    }

    /**
     * Initializes structural sizing rules.
     */
    initViewport() {
        // Force the initial DOM states matching defaults
        const activeCard = this.themesContainer.querySelector(`[data-theme="${this.activeThemeId}"]`);
        if (activeCard) activeCard.click();

        this.resizePreviewCanvas();
    }

    /**
     * Scales backing storage to twice the CSS viewport sizes, preventing blurry lines on Retina/Apple screens.
     */
    resizePreviewCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = this.canvasViewport.clientWidth;
        const cssHeight = this.canvasViewport.clientHeight;

        if (cssWidth === 0 || cssHeight === 0) return;

        this.previewCanvas.width = cssWidth * dpr;
        this.previewCanvas.height = cssHeight * dpr;

        // Apply pixel scaling context
        this.previewCtx.resetTransform();
        this.previewCtx.scale(dpr, dpr);

        this.needsRedraw = true;
    }

    /**
     * Resolves variables combined from active theme constants and custom form Select inputs.
     */
    getCombinedTheme() {
        const baseTheme = ThemeManager.getTheme(this.activeThemeId);
        return {
            ...baseTheme,
            fontFamily: this.fontSelect.value
        };
    }

    /**
     * Starts the lightweight high-frequency requestAnimationFrame render tick loop.
     */
    startRenderingLoop() {
        const loop = () => {
            if (!this.isActive) return;

            const time = Date.now() - this.startTime;
            const theme = this.getCombinedTheme();
            const cssWidth = this.canvasViewport.clientWidth;
            const cssHeight = this.canvasViewport.clientHeight;

            if (cssWidth > 0 && cssHeight > 0) {
                // Renders the background, dawn lights, mountains, balanced text, vignettes, borders, watermarks
                ExportEngine.renderStaticLayout(this.previewCtx, theme, this.text, cssWidth, cssHeight, this.fontSizeSliderValue, time, false);
                
                // Overlay float-breathing spiritual fireflies/star twinkles in preview mode only
                this.motionPreview.updateAndDrawParticles(this.previewCtx, theme, cssWidth, cssHeight);
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    setLoadingState(isLoading, message = '') {
        const loader = document.getElementById('viewportLoader');
        if (!loader) return;
        
        if (isLoading) {
            loader.style.display = 'flex';
            const label = loader.querySelector('span:last-child');
            if (label) label.textContent = message;
            this.downloadBtn.disabled = true;
            this.shareBtn.disabled = true;
        } else {
            loader.style.display = 'none';
            this.downloadBtn.disabled = false;
            this.shareBtn.disabled = false;
        }
    }

    /**
     * Floating toast animations.
     */
    showToast(message) {
        if (!this.toast) return;

        this.toast.textContent = message;
        this.toast.hidden = false;
        this.toast.classList.add('is-visible');

        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.toast.classList.remove('is-visible');
            this.toast.hidden = true;
        }, 2200);
    }
}

// 6. Automatically instantiate the engine when HTML finishes loading
document.addEventListener('DOMContentLoaded', () => {
    window.posterEngine = new PosterEngine();
});
