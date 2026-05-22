/**
 * أجر لا ينقطع - BackgroundSystem
 * Renders procedural, highly-ambient spiritual backdrops and atmospheric effects.
 */

export class BackgroundSystem {
    /**
     * Renders the background gradient, horizon lights, and vignettes.
     */
    static drawBackground(ctx, theme, width, height, time = 0) {
        const scale = height / 1000;
        ctx.save();

        // 1. Draw base theme background gradient
        if (theme.id === 'night-spiritual') {
            // Celestial radial deep indigo sky
            const baseGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.35, 10 * scale,
                width * 0.5, height * 0.5, Math.max(width, height) * 0.8
            );
            baseGrad.addColorStop(0, '#111e30'); // Deep glowing indigo
            baseGrad.addColorStop(0.4, '#080d15'); // Night abyss
            baseGrad.addColorStop(1, '#030508'); // Absolute void
            ctx.fillStyle = baseGrad;
            ctx.fillRect(0, 0, width, height);

        } else if (theme.id === 'nature-serenity') {
            // Misty morning forest gradient
            const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
            baseGrad.addColorStop(0, '#0c1a13'); // Deep teal green
            baseGrad.addColorStop(0.5, '#070f0b'); // Forest night
            baseGrad.addColorStop(1, '#030604'); // Ground dark green
            ctx.fillStyle = baseGrad;
            ctx.fillRect(0, 0, width, height);

            // Soft peach/gold dawn horizon radial glow at the bottom
            const horizonGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.95, 20 * scale,
                width * 0.5, height * 0.95, width * 0.7
            );
            horizonGrad.addColorStop(0, 'rgba(235, 195, 160, 0.12)'); // Peach horizon light
            horizonGrad.addColorStop(0.4, 'rgba(168, 211, 180, 0.04)'); // Soft mint glow
            horizonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = horizonGrad;
            ctx.fillRect(0, 0, width, height);

        } else if (theme.id === 'minimal-noor') {
            // Ultra-calming warm ivory / pristine sand radial gradient
            const baseGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.4, 50 * scale,
                width * 0.5, height * 0.5, Math.max(width, height) * 0.7
            );
            baseGrad.addColorStop(0, '#f9f6f0'); // Warm white light center
            baseGrad.addColorStop(0.6, '#f3ebd9'); // Soft cream
            baseGrad.addColorStop(1, '#e5d8c3'); // Earthy sand
            ctx.fillStyle = baseGrad;
            ctx.fillRect(0, 0, width, height);

        } else if (theme.id === 'premium-gold') {
            // Deep obsidian velvet black
            const baseGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.5, 10 * scale,
                width * 0.5, height * 0.5, Math.max(width, height) * 0.7
            );
            baseGrad.addColorStop(0, '#1c1c1f'); // Charcoal center warmth
            baseGrad.addColorStop(0.5, '#0e0e10'); // Dark velvet obsidian
            baseGrad.addColorStop(1, '#050506'); // Infinite black
            ctx.fillStyle = baseGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Draw subtle dark vignette (Except for Minimal Noor)
        if (theme.id !== 'minimal-noor') {
            const vignetteGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.5, Math.min(width, height) * 0.4,
                width * 0.5, height * 0.5, Math.max(width, height) * 0.8
            );
            vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignetteGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
            vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
            ctx.fillStyle = vignetteGrad;
            ctx.fillRect(0, 0, width, height);
        } else {
            // Soft white/light vignette for Minimal Noor to draw eyes inwards
            const vignetteGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.5, Math.min(width, height) * 0.3,
                width * 0.5, height * 0.5, Math.max(width, height) * 0.8
            );
            vignetteGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            vignetteGrad.addColorStop(0.6, 'rgba(229, 216, 195, 0.1)');
            vignetteGrad.addColorStop(1, 'rgba(188, 163, 116, 0.15)');
            ctx.fillStyle = vignetteGrad;
            ctx.fillRect(0, 0, width, height);
        }

        ctx.restore();
    }

    /**
     * Renders ambient details like halos, mist sways, and scenery.
     */
    static drawAtmosphere(ctx, theme, width, height, time = 0) {
        const scale = height / 1000;
        ctx.save();

        const breathe = Math.sin(time * 0.001) * 0.05; // Gentle rhythmic breath

        if (theme.id === 'night-spiritual') {
            // Soft glowing golden/moonlit central celestial halo
            const haloGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.38, 10 * scale,
                width * 0.5, height * 0.38, height * (0.28 + breathe)
            );
            haloGrad.addColorStop(0, 'rgba(235, 210, 170, 0.09)'); // Soft gold core
            haloGrad.addColorStop(0.3, 'rgba(200, 166, 115, 0.04)'); // Ambient dispersion
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(width * 0.5, height * 0.38, height * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Very subtle drifting background star-mist
            this.drawMistBand(ctx, width, height, height * 0.65, 'rgba(255, 255, 255, 0.005)', time * 0.1);
            this.drawMistBand(ctx, width, height, height * 0.72, 'rgba(140, 170, 200, 0.008)', -time * 0.08);

        } else if (theme.id === 'nature-serenity') {
            // Draw overlapping misty mountains silhouette in the bottom background
            this.drawMountainSilhouettes(ctx, width, height, scale, time);

            // Draw a central breathing light column halo
            const haloGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.42, 5 * scale,
                width * 0.5, height * 0.42, height * (0.3 + breathe)
            );
            haloGrad.addColorStop(0, 'rgba(200, 240, 215, 0.07)'); // soft mint core
            haloGrad.addColorStop(0.5, 'rgba(168, 211, 180, 0.02)');
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(width * 0.5, height * 0.42, height * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Drifting misty forest fog
            this.drawMistBand(ctx, width, height, height * 0.78, 'rgba(168, 211, 180, 0.015)', time * 0.07);

        } else if (theme.id === 'minimal-noor') {
            // Soft white glowing spiritual beam
            const haloGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.38, 20 * scale,
                width * 0.5, height * 0.38, height * (0.38 + breathe)
            );
            haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)'); // Pure light center
            haloGrad.addColorStop(0.4, 'rgba(245, 235, 220, 0.12)'); // Diffusion
            haloGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(width * 0.5, height * 0.38, height * 0.5, 0, Math.PI * 2);
            ctx.fill();

        } else if (theme.id === 'premium-gold') {
            // Elegant thin luxury glow behind text
            const haloGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.45, 5 * scale,
                width * 0.5, height * 0.45, height * (0.24 + breathe)
            );
            haloGrad.addColorStop(0, 'rgba(212, 175, 55, 0.08)'); // Deep gold glow
            haloGrad.addColorStop(0.6, 'rgba(181, 148, 43, 0.02)');
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(width * 0.5, height * 0.45, height * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Soft luxury velvet smoke
            this.drawMistBand(ctx, width, height, height * 0.70, 'rgba(212, 175, 55, 0.003)', time * 0.05);
        }

        ctx.restore();
    }

    /**
     * Draws borders, corners, diamonds, and frames.
     */
    static drawDecorations(ctx, theme, width, height) {
        const scale = height / 1000;
        ctx.save();

        if (theme.id === 'minimal-noor') {
            // Thin elegant sand-gold border inset
            const margin = 50 * scale;
            ctx.strokeStyle = 'rgba(188, 163, 116, 0.25)';
            ctx.lineWidth = 1 * scale;
            ctx.beginPath();
            ctx.rect(margin, margin, width - margin * 2, height - margin * 2);
            ctx.stroke();

            // Draw small micro-dots at four corners of the border
            ctx.fillStyle = 'rgba(188, 163, 116, 0.5)';
            const coords = [
                [margin, margin],
                [width - margin, margin],
                [margin, height - margin],
                [width - margin, height - margin]
            ];
            for (const [cx, cy] of coords) {
                ctx.beginPath();
                ctx.arc(cx, cy, 3 * scale, 0, Math.PI * 2);
                ctx.fill();
            }

        } else if (theme.id === 'premium-gold') {
            // Double golden luxury lines
            const marginOuter = 40 * scale;
            const marginInner = 48 * scale;

            // 1. Draw outer thin frame
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
            ctx.lineWidth = 1.2 * scale;
            ctx.beginPath();
            ctx.rect(marginOuter, marginOuter, width - marginOuter * 2, height - marginOuter * 2);
            ctx.stroke();

            // 2. Draw inner ultra-fine frame
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
            ctx.lineWidth = 0.6 * scale;
            ctx.beginPath();
            ctx.rect(marginInner, marginInner, width - marginInner * 2, height - marginInner * 2);
            ctx.stroke();

            // 3. Draw premium elegant gold diamonds at four corners of the inner frame
            const innerCoords = [
                [marginInner, marginInner],
                [width - marginInner, marginInner],
                [marginInner, height - marginInner],
                [width - marginInner, height - marginInner]
            ];
            ctx.fillStyle = 'rgba(212, 175, 55, 0.85)';
            for (const [cx, cy] of innerCoords) {
                this.drawDiamond(ctx, cx, cy, 5 * scale);
            }

            // Draw an elegant small calligraphic gold accent dot/diamond at the top center below border
            this.drawDiamond(ctx, width * 0.5, marginInner + 30 * scale, 6 * scale);

        } else if (theme.id === 'night-spiritual') {
            // Single ultra-subtle starry blue border
            const margin = 48 * scale;
            ctx.strokeStyle = 'rgba(244, 239, 230, 0.08)';
            ctx.lineWidth = 1.0 * scale;
            ctx.beginPath();
            ctx.rect(margin, margin, width - margin * 2, height - margin * 2);
            ctx.stroke();

            // Tiny delicate cross stars in the corner
            const coords = [
                [margin, margin],
                [width - margin, margin],
                [margin, height - margin],
                [width - margin, height - margin]
            ];
            ctx.strokeStyle = 'rgba(200, 166, 115, 0.4)';
            ctx.lineWidth = 0.8 * scale;
            for (const [cx, cy] of coords) {
                ctx.beginPath();
                ctx.moveTo(cx - 5 * scale, cy);
                ctx.lineTo(cx + 5 * scale, cy);
                ctx.moveTo(cx, cy - 5 * scale);
                ctx.lineTo(cx, cy + 5 * scale);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    /**
     * Draws a balanced mountain silhouette at the bottom (Nature Serenity preset).
     */
    static drawMountainSilhouettes(ctx, width, height, scale, time) {
        ctx.save();
        
        // 1. Far mountains (lighter slate green)
        ctx.fillStyle = 'rgba(10, 22, 15, 0.35)';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * 0.86);
        ctx.bezierCurveTo(
            width * 0.25, height * 0.83,
            width * 0.45, height * 0.88,
            width * 0.65, height * 0.85
        );
        ctx.bezierCurveTo(
            width * 0.8, height * 0.83,
            width * 0.9, height * 0.87,
            width, height * 0.84
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // 2. Near mountains (darker deep emerald gray)
        ctx.fillStyle = 'rgba(6, 14, 10, 0.75)';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * 0.91);
        ctx.bezierCurveTo(
            width * 0.3, height * 0.88,
            width * 0.55, height * 0.94,
            width * 0.75, height * 0.9
        );
        ctx.bezierCurveTo(
            width * 0.88, height * 0.88,
            width * 0.95, height * 0.92,
            width, height * 0.89
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    /**
     * Draws a horizontal wide mist band sways by time waves.
     */
    static drawMistBand(ctx, width, height, baseY, color, speedTime) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        
        // Dynamic sine curve coordinates for mist
        const points = 5;
        const segment = width / points;
        ctx.moveTo(0, height);
        
        const amp = 15 * (height / 1000);
        ctx.lineTo(0, baseY);
        
        for (let i = 1; i <= points; i++) {
            const x = i * segment;
            const wave = Math.sin(speedTime + i) * amp;
            const prevX = (i - 1) * segment;
            const prevY = baseY + Math.sin(speedTime + (i - 1)) * amp;
            ctx.bezierCurveTo(
                prevX + segment * 0.5, prevY,
                x - segment * 0.5, baseY + wave,
                x, baseY + wave
            );
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * Renders a vector diamond shape.
     */
    static drawDiamond(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fill();
    }
}
