/**
 * أجر لا ينقطع - ShareSystem
 * Leverages native Web Share APIs for direct mobile system shares (AirDrop, WhatsApp, Instagram Stories).
 * Fallbacks gracefully to high-end clipboard link copying with micro-toasts.
 */

import { ExportEngine } from './ExportEngine.js';

export class ShareSystem {
    /**
     * Attempts a native file share or triggers clipboard fallback.
     */
    static async sharePoster(exportCanvas, theme, text, ratio, baseFontSlider, showToastCallback) {
        if (!exportCanvas) return;

        // 1. Compile design into high-DPI export canvas
        const resolution = ExportEngine.getResolutionByRatio(ratio);
        exportCanvas.width = resolution.width;
        exportCanvas.height = resolution.height;

        const ctx = exportCanvas.getContext('2d');
        if (!ctx) {
            showToastCallback('عذرًا، حدث خطأ في معالجة لوحتك 😢');
            return;
        }

        // Render the exact static layout
        ExportEngine.renderStaticLayout(ctx, theme, text, resolution.width, resolution.height, baseFontSlider, 0, true);

        // 2. Convert to binary Blob and File instance
        exportCanvas.toBlob(async (blob) => {
            if (!blob) {
                showToastCallback('عذرًا، فشل تجهيز ملف المشاركة 😢');
                return;
            }

            const file = new File([blob], `ajr_dhikr_${ratio}.png`, { type: 'image/png' });

            // 3. Test if system can handle direct file sharing
            const isNativeShareSupported = navigator.canShare && navigator.canShare({ files: [file] });

            if (isNativeShareSupported) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'بطاقة ذكر فنية | أجر لا ينقطع 🤍',
                        text: `"${text}"\n\nصُممت هذه اللوحة الفنية عبر مشروع أجر لا ينقطع ✨`
                    });
                } catch (err) {
                    // AbortError is raised when the user manually cancels the native share sheet
                    if (err.name !== 'AbortError') {
                        this.fallbackToClipboard(text, showToastCallback);
                    }
                }
            } else {
                // Standard desktop browser clipboard fallback
                this.fallbackToClipboard(text, showToastCallback);
            }
        }, 'image/png');
    }

    /**
     * Fallback copy routine compiling a clean sharable URL.
     */
    static fallbackToClipboard(text, showToastCallback) {
        const shareUrl = new URL(window.location.origin + '/poster');
        shareUrl.searchParams.set('text', text);

        const fullCopyText = `"${text}"\n\nشاهد لوحة الذكر الفنية وشاركها كصدقة جارية:\n${shareUrl.toString()}`;
        const plainFallbackText = `"${text}"\n\nمشروع أجر لا ينقطع 🤍`;

        // Single source lib/share.js when available (own textarea fallback
        // included); plain clipboard otherwise. Resolved `false` and
        // rejections both mean "not copied" and trigger the second tier.
        const copy = globalThis.ShareLib
            ? (value) => globalThis.ShareLib.copyText(value)
            : (value) => navigator.clipboard.writeText(value);

        const secondTier = () => copy(plainFallbackText).then(
            (copied) => { if (copied !== false) showToastCallback('تم نسخ نص الذكر لمشاركته! 🕊'); },
            () => {},
        );

        copy(fullCopyText).then(
            (copied) => {
                if (copied !== false) showToastCallback('تم نسخ رابط لوحتك الفنية لمشاركتها! ✨');
                else secondTier();
            },
            () => secondTier(),
        );
    }
}
