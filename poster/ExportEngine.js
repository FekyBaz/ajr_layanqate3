/**
 * أجر لا ينقطع - ExportEngine
 * Handles high-DPI, vector-sharp canvas rendering and image file downloads.
 */

import { BackgroundSystem } from './BackgroundSystem.js';
import { TypographySystem } from './TypographySystem.js';

export class ExportEngine {
    /**
     * Resolves absolute pixel dimensions based on target aspect ratios.
     */
    static getResolutionByRatio(ratio) {
        switch (ratio) {
            case 'story':
                return { width: 1080, height: 1920 };
            case 'landscape':
                return { width: 1600, height: 900 };
            case 'wallpaper':
                return { width: 1440, height: 2560 };
            case 'square':
            default:
                return { width: 1080, height: 1080 };
        }
    }

    /**
     * Renders a static, pixel-perfect layout state onto any target canvas context.
     * Reused by both live preview tick loops and export builders.
     */
    static renderStaticLayout(ctx, theme, text, width, height, baseFontSlider, time = 0, isExport = false) {
        const scale = height / 1000;

        // 1. Clear context
        ctx.clearRect(0, 0, width, height);

        // 2. Draw atmospheric backing
        BackgroundSystem.drawBackground(ctx, theme, width, height, time);
        BackgroundSystem.drawAtmosphere(ctx, theme, width, height, time);

        // 3. Render a static distribution of particles for exports to preserve starry dust
        if (isExport) {
            this.drawStaticStarDust(ctx, theme, width, height, scale);
        }

        // 4. Calculate smart typography bounds and wraps
        const layout = TypographySystem.computeOptimalLayout(ctx, text, width, height, theme, baseFontSlider);

        // 5. Draw text lines centered with subtle drop shadow
        ctx.save();
        ctx.fillStyle = theme.fontColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Apply elegant drop shadow for readable contrast against atmospheric lights
        if (theme.id !== 'minimal-noor') {
            ctx.shadowColor = theme.shadowColor;
            ctx.shadowBlur = 10 * scale;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 3 * scale;
        } else {
            // Soft paper-pressed light shadow
            ctx.shadowColor = 'rgba(188, 163, 116, 0.1)';
            ctx.shadowBlur = 2 * scale;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1 * scale;
        }

        // Re-apply the computed final balanced font
        let fontStyle = `500 ${layout.fontSize}px "${theme.fontFamily}", Amiri, Tajawal, sans-serif`;
        if (theme.fontFamily === 'Amiri') {
            fontStyle = `700 ${layout.fontSize}px "Amiri", serif`;
        } else if (theme.fontFamily === 'Cairo') {
            fontStyle = `800 ${layout.fontSize}px "Cairo", sans-serif`;
        } else if (theme.fontFamily === 'Reem Kufi') {
            fontStyle = `600 ${layout.fontSize}px "Reem Kufi", sans-serif`;
        } else if (theme.fontFamily === 'IBM Plex Sans Arabic') {
            fontStyle = `500 ${layout.fontSize}px "IBM Plex Sans Arabic", sans-serif`;
        } else if (theme.fontFamily === 'Tajawal') {
            fontStyle = `700 ${layout.fontSize}px "Tajawal", sans-serif`;
        }
        ctx.font = fontStyle;

        // Draw each line beautifully aligned vertically
        const linesCount = layout.lines.length;
        const totalTextHeight = linesCount * layout.lineHeight;
        
        // Vertically center-aligned offset baseline calculation
        const startY = (height - totalTextHeight) / 2 + layout.lineHeight / 2;

        layout.lines.forEach((lineText, idx) => {
            const lineY = startY + idx * layout.lineHeight;
            ctx.fillText(lineText, width * 0.5, lineY);
        });

        ctx.restore();

        // 6. Draw theme-specific borders and geometric corners
        BackgroundSystem.drawDecorations(ctx, theme, width, height);

        // 7. Draw the elegant tiny platform branding watermark
        this.drawWatermark(ctx, theme, width, height, scale);
    }

    /**
     * Renders a static aesthetic distribution of stars/particles for export files.
     */
    static drawStaticStarDust(ctx, theme, width, height, scale) {
        ctx.save();
        ctx.fillStyle = theme.particleColor;

        // Use a pseudo-random distribution seeded by coordinate calculations to keep it static yet balanced
        const seedPoints = theme.particleCount * 0.8;
        for (let i = 0; i < seedPoints; i++) {
            const cx = ((Math.sin(i * 12.3) + 1) * 0.5) * width;
            const cy = ((Math.cos(i * 35.7) + 1) * 0.5) * height;
            const radius = (1.0 + ((i % 4) * 0.5)) * scale;
            const alpha = 0.18 + ((i % 3) * 0.12);

            ctx.globalAlpha = alpha;
            ctx.beginPath();

            if (theme.id === 'premium-gold') {
                const size = radius * 1.5;
                ctx.moveTo(cx, cy - size);
                ctx.lineTo(cx + size, cy);
                ctx.lineTo(cx, cy + size);
                ctx.lineTo(cx - size, cy);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    /**
     * Draws an elegant spiritual branding mark at the bottom center.
     */
    static drawWatermark(ctx, theme, width, height, scale) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = theme.secondaryColor;
        ctx.globalAlpha = theme.id === 'minimal-noor' ? 0.7 : 0.45;
        
        ctx.font = `500 ${11 * scale}px "Cairo", Tajawal, sans-serif`;
        
        const watermarkText = 'أجر لا ينقطع 🤍 ajr.layanqate3';
        const insetY = theme.id === 'premium-gold' ? 68 * scale : 60 * scale;
        
        ctx.fillText(watermarkText, width * 0.5, height - insetY);
        ctx.restore();
    }

    /**
     * Triggers direct browser image downloads of the compiled high-DPI canvas.
     */
    static async downloadPoster(exportCanvas, theme, text, ratio, baseFontSlider) {
        const resolution = this.getResolutionByRatio(ratio);
        
        // 1. Force the hidden canvas dimensions to matches high-DPI bounds
        exportCanvas.width = resolution.width;
        exportCanvas.height = resolution.height;

        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;

        // 2. Perform static rendering
        this.renderStaticLayout(ctx, theme, text, resolution.width, resolution.height, baseFontSlider, 0, true);

        // 3. Export via standard anchor element
        return new Promise((resolve) => {
            exportCanvas.toBlob((blob) => {
                if (!blob) {
                    resolve(false);
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ajr_dhikr_${ratio}_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                
                // Cleanup resource
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve(true);
                }, 100);
            }, 'image/png');
        });
    }
}
