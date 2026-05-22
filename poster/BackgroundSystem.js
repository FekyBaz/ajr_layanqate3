/**
 * أجر لا ينقطع - BackgroundSystem
 * Renders procedural, highly-ambient spiritual backdrops and atmospheric effects.
 */

export class BackgroundSystem {
    static imageCache = {};

    static getThemeImage(src) {
        if (BackgroundSystem.imageCache[src]) {
            return BackgroundSystem.imageCache[src];
        }
        const img = new Image();
        img.src = src;
        img.isLoaded = false;
        img.onload = () => {
            img.isLoaded = true;
            if (window.posterEngine) {
                window.posterEngine.needsRedraw = true;
            }
        };
        BackgroundSystem.imageCache[src] = img;
        return img;
    }

    static drawImageCover(ctx, img, width, height) {
        if (!img.isLoaded || img.naturalWidth === 0) return;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = width / height;
        
        let sx, sy, sWidth, sHeight;
        
        if (canvasRatio > imgRatio) {
            // Canvas is wider than Image
            sWidth = img.naturalWidth;
            sHeight = img.naturalWidth / canvasRatio;
            sx = 0;
            sy = (img.naturalHeight - sHeight) / 2;
        } else {
            // Canvas is taller than Image
            sWidth = img.naturalHeight * canvasRatio;
            sHeight = img.naturalHeight;
            sx = (img.naturalWidth - sWidth) / 2;
            sy = 0;
        }
        
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
    }

    /**
     * Renders the background gradient, horizon lights, and vignettes.
     */
    static drawBackground(ctx, theme, width, height, time = 0) {
        const scale = height / 1000;
        ctx.save();

        // 1. Draw base theme background gradient
        if (theme.id === 'night-spiritual') {
            // Try loading/drawing the beautiful watercolor night background image
            const bgImg = BackgroundSystem.getThemeImage('poster/night-serenity-bg.png');
            if (bgImg.isLoaded) {
                BackgroundSystem.drawImageCover(ctx, bgImg, width, height);
            } else {
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
            }

        } else if (theme.id === 'nature-serenity') {
            // Try loading/drawing the beautiful watercolor morning forest background image
            const bgImg = BackgroundSystem.getThemeImage('poster/nature-serenity-bg.png');
            if (bgImg.isLoaded) {
                BackgroundSystem.drawImageCover(ctx, bgImg, width, height);
            } else {
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
            }

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
            // Try loading/drawing the beautiful dark gold abstract background image
            const bgImg = BackgroundSystem.getThemeImage('poster/premium-gold-bg.png');
            if (bgImg.isLoaded) {
                BackgroundSystem.drawImageCover(ctx, bgImg, width, height);
            } else {
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

        } else if (theme.id === 'paradise-spring') {
            // Try loading/drawing the beautiful watercolor background image
            const bgImg = BackgroundSystem.getThemeImage('poster/paradise-spring-bg.jpg');
            if (bgImg.isLoaded) {
                BackgroundSystem.drawImageCover(ctx, bgImg, width, height);
            } else {
                // Fallback procedural watercolor green-cream sky while loading
                const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
                baseGrad.addColorStop(0, '#f2efe9'); // Very soft warm watercolor paper ivory
                baseGrad.addColorStop(0.6, '#eef3eb'); // Delicate washed mint-white
                baseGrad.addColorStop(1, '#dfe7db'); // Pale mossy watercolor cream
                ctx.fillStyle = baseGrad;
                ctx.fillRect(0, 0, width, height);

                // Radial ambient gold sun/glow in top left
                const sunGrad = ctx.createRadialGradient(
                    width * 0.15, height * 0.15, 10 * scale,
                    width * 0.15, height * 0.15, width * 0.5
                );
                sunGrad.addColorStop(0, 'rgba(239, 218, 187, 0.25)'); // Gentle golden watercolor glow
                sunGrad.addColorStop(0.5, 'rgba(226, 234, 223, 0.05)');
                sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = sunGrad;
                ctx.fillRect(0, 0, width, height);
            }
        }

        // 2. Draw subtle dark vignette (Except for Minimal Noor and Paradise Spring)
        if (theme.id !== 'minimal-noor' && theme.id !== 'paradise-spring') {
            const vignetteGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.5, Math.min(width, height) * 0.4,
                width * 0.5, height * 0.5, Math.max(width, height) * 0.8
            );
            vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignetteGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
            vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
            ctx.fillStyle = vignetteGrad;
            ctx.fillRect(0, 0, width, height);
        } else if (theme.id === 'paradise-spring') {
            // Soft sage green vignette for watercolor theme
            const vignetteGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.5, Math.min(width, height) * 0.35,
                width * 0.5, height * 0.5, Math.max(width, height) * 0.82
            );
            vignetteGrad.addColorStop(0, 'rgba(242, 239, 233, 0)');
            vignetteGrad.addColorStop(0.65, 'rgba(107, 142, 117, 0.04)');
            vignetteGrad.addColorStop(1, 'rgba(62, 123, 92, 0.12)');
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
            // Draw overlapping misty mountains silhouette in the bottom background (only as fallback if image is not loaded)
            const bgImg = BackgroundSystem.imageCache['poster/nature-serenity-bg.png'];
            const isImgLoaded = bgImg && bgImg.isLoaded;
            if (!isImgLoaded) {
                this.drawMountainSilhouettes(ctx, width, height, scale, time);
            }

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

        } else if (theme.id === 'paradise-spring') {
            // Overlapping misty watercolor hills at the bottom (only as fallback if image is not loaded)
            const bgImg = BackgroundSystem.imageCache['poster/paradise-spring-bg.jpg'];
            const isImgLoaded = bgImg && bgImg.isLoaded;
            if (!isImgLoaded) {
                this.drawWatercolorHills(ctx, width, height, scale, time);
            }

            // Breathable soft column of light in center
            const haloGrad = ctx.createRadialGradient(
                width * 0.5, height * 0.42, 5 * scale,
                width * 0.5, height * 0.42, height * (0.32 + breathe)
            );
            haloGrad.addColorStop(0, 'rgba(240, 245, 238, 0.35)'); // Soft paper bright core
            haloGrad.addColorStop(0.5, 'rgba(223, 231, 219, 0.05)');
            haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(width * 0.5, height * 0.42, height * 0.45, 0, Math.PI * 2);
            ctx.fill();
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
            const margin = 52 * scale;
            ctx.strokeStyle = 'rgba(197, 168, 128, 0.45)'; // Warm shimmering gold
            ctx.lineWidth = 1.2 * scale;
            
            // Outer Arch Frame Coordinates
            const left = margin;
            const right = width - margin;
            const bottom = height - margin;
            const top = margin + 30 * scale; // Keep arch peak slightly below margin
            const arcStartY = margin + (height - margin * 2) * 0.22; // Start curving at top 22%

            ctx.beginPath();
            ctx.moveTo(left, bottom);
            ctx.lineTo(left, arcStartY);
            
            // Elegant Islamic arched curvature peak
            ctx.bezierCurveTo(
                left, arcStartY - 60 * scale,
                width * 0.5 - 50 * scale, top,
                width * 0.5, top
            );
            ctx.bezierCurveTo(
                width * 0.5 + 50 * scale, top,
                right, arcStartY - 60 * scale,
                right, arcStartY
            );
            
            ctx.lineTo(right, bottom);
            ctx.closePath();
            ctx.stroke();

            // Inner Fine Arch Frame (Double arch for premium look)
            ctx.strokeStyle = 'rgba(197, 168, 128, 0.18)';
            ctx.lineWidth = 0.6 * scale;
            const innerMargin = margin + 6 * scale;
            const iLeft = innerMargin;
            const iRight = width - innerMargin;
            const iBottom = height - innerMargin;
            const iTop = innerMargin + 30 * scale;
            const iArcStartY = innerMargin + (height - innerMargin * 2) * 0.22;

            ctx.beginPath();
            ctx.moveTo(iLeft, iBottom);
            ctx.lineTo(iLeft, iArcStartY);
            ctx.bezierCurveTo(
                iLeft, iArcStartY - 54 * scale,
                width * 0.5 - 45 * scale, iTop,
                width * 0.5, iTop
            );
            ctx.bezierCurveTo(
                width * 0.5 + 45 * scale, iTop,
                iRight, iArcStartY - 54 * scale,
                iRight, iArcStartY
            );
            ctx.lineTo(iRight, iBottom);
            ctx.closePath();
            ctx.stroke();

            // Draw a majestic small gold diamond at the peak of the arch
            ctx.fillStyle = 'rgba(197, 168, 128, 0.85)';
            this.drawDiamond(ctx, width * 0.5, top - 12 * scale, 4 * scale);

            // Tiny elegant dots at the bottom corners
            ctx.fillStyle = 'rgba(197, 168, 128, 0.5)';
            ctx.beginPath();
            ctx.arc(left, bottom, 2.5 * scale, 0, Math.PI * 2);
            ctx.arc(right, bottom, 2.5 * scale, 0, Math.PI * 2);
            ctx.fill();

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

        } else if (theme.id === 'paradise-spring') {
            // Only draw procedural fallback foliage if background image is not loaded
            const bgImg = BackgroundSystem.imageCache['poster/paradise-spring-bg.jpg'];
            const isImgLoaded = bgImg && bgImg.isLoaded;
            if (!isImgLoaded) {
                // 1. Primary main branch Top-Left
                const p0_1 = { x: -15 * scale, y: -15 * scale };
                const p1_1 = { x: width * 0.28, y: height * 0.08 };
                const p2_1 = { x: width * 0.42, y: height * 0.22 };
                this.drawBranchOfLeaves(ctx, p0_1, p1_1, p2_1, 14, 46 * scale, '#123524');

                // 2. Secondary side branch Top-Left (angled slightly lower down the left edge)
                const p0_2 = { x: -15 * scale, y: height * 0.12 };
                const p1_2 = { x: width * 0.18, y: height * 0.25 };
                const p2_2 = { x: width * 0.32, y: height * 0.38 };
                this.drawBranchOfLeaves(ctx, p0_2, p1_2, p2_2, 11, 40 * scale, '#1E4233');

                // 3. Third branch starting further top-right, draping down towards center
                const p0_3 = { x: width * 0.20, y: -15 * scale };
                const p1_3 = { x: width * 0.35, y: height * 0.15 };
                const p2_3 = { x: width * 0.50, y: height * 0.20 };
                this.drawBranchOfLeaves(ctx, p0_3, p1_3, p2_3, 10, 36 * scale, '#265440');

                // 4. Balancing small branch in the bottom-right corner
                const p0_4 = { x: width + 15 * scale, y: height + 15 * scale };
                const p1_4 = { x: width * 0.82, y: height * 0.82 };
                const p2_4 = { x: width * 0.70, y: height * 0.74 };
                this.drawBranchOfLeaves(ctx, p0_4, p1_4, p2_4, 9, 38 * scale, '#1E4233');
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
     * Draws a single organic pointed leaf mathematically using two quadratic curves meeting at the tip.
     */
    static drawSingleLeaf(ctx, x, y, angle, length, width, leafColor) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Create watercolor shading gradient
        const grad = ctx.createLinearGradient(0, 0, length, 0);
        grad.addColorStop(0, leafColor); // Base color (deep)
        grad.addColorStop(1, 'rgba(165, 195, 159, 0.9)'); // Soft Sage Green highlight tip
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(length * 0.35, -width * 0.5, length, 0);
        ctx.quadraticCurveTo(length * 0.35, width * 0.5, 0, 0);
        ctx.closePath();
        ctx.fill();

        // Delicate vein in the middle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(length * 0.85, 0);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Renders a curved woody branch with alternating organic leaf pairs along a quadratic Bezier path B(t).
     */
    static drawBranchOfLeaves(ctx, p0, p1, p2, leafCount, baseLeafSize, leafColor) {
        ctx.save();
        
        // Draw the curved woody branch stem
        ctx.strokeStyle = 'rgba(84, 98, 77, 0.35)'; // Soft watercolor woody stem
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
        ctx.stroke();

        // Populate leaves along the stem
        for (let i = 2; i <= leafCount; i++) {
            const t = i / leafCount;
            
            // Compute coordinate B(t)
            const mt = 1 - t;
            const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
            const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
            
            // Compute tangent direction derivative B'(t)
            const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
            const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
            const tangentAngle = Math.atan2(dy, dx);
            
            // Leaf size decreases towards the branch tip
            const leafSize = baseLeafSize * (1.1 - t * 0.35);
            
            // Sprout a pair of leaves at alternating angles
            this.drawSingleLeaf(ctx, x, y, tangentAngle - 0.45 - Math.sin(t * 4) * 0.15, leafSize, leafSize * 0.45, leafColor);
            this.drawSingleLeaf(ctx, x, y, tangentAngle + 0.45 + Math.sin(t * 4) * 0.15, leafSize, leafSize * 0.45, leafColor);
            
            // Random-like twig sprouts
            if (i % 3 === 0 && t < 0.78) {
                const isLeft = (i % 2 === 0);
                const twigAngle = tangentAngle + (isLeft ? 0.75 : -0.75);
                const twigLen = leafSize * 1.4;
                const tx = x + Math.cos(twigAngle) * twigLen * 0.4;
                const ty = y + Math.sin(twigAngle) * twigLen * 0.4;
                
                ctx.strokeStyle = 'rgba(84, 98, 77, 0.25)';
                ctx.lineWidth = 1.0;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(tx, ty);
                ctx.stroke();
                
                this.drawSingleLeaf(ctx, tx, ty, twigAngle, leafSize * 0.75, leafSize * 0.32, leafColor);
            }
        }
        
        // Single leaf at absolute branch tip B(1)
        const tipAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        this.drawSingleLeaf(ctx, p2.x, p2.y, tipAngle, baseLeafSize * 0.55, baseLeafSize * 0.22, leafColor);

        ctx.restore();
    }

    /**
     * Renders overlapping green watercolor hills at the bottom.
     */
    static drawWatercolorHills(ctx, width, height, scale, time) {
        ctx.save();
        
        // 1. Far Hill Layer (Soft sage green, high)
        const grad1 = ctx.createLinearGradient(0, height * 0.65, 0, height);
        grad1.addColorStop(0, 'rgba(182, 203, 178, 0.42)');
        grad1.addColorStop(1, 'rgba(223, 231, 219, 0.05)');
        ctx.fillStyle = grad1;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * 0.76);
        ctx.bezierCurveTo(
            width * 0.3, height * 0.71,
            width * 0.68, height * 0.81,
            width, height * 0.74
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // 2. Mid Hill Layer (Medium green watercolor, middle)
        const grad2 = ctx.createLinearGradient(0, height * 0.73, 0, height);
        grad2.addColorStop(0, 'rgba(141, 168, 137, 0.58)');
        grad2.addColorStop(1, 'rgba(207, 219, 202, 0.08)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * 0.82);
        ctx.bezierCurveTo(
            width * 0.35, height * 0.87,
            width * 0.72, height * 0.79,
            width, height * 0.84
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // 3. Near Hill Layer (Rich mossy watercolor, low)
        const grad3 = ctx.createLinearGradient(0, height * 0.8, 0, height);
        grad3.addColorStop(0, 'rgba(92, 122, 98, 0.78)');
        grad3.addColorStop(1, 'rgba(165, 185, 159, 0.15)');
        ctx.fillStyle = grad3;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * 0.87);
        ctx.bezierCurveTo(
            width * 0.28, height * 0.84,
            width * 0.6, height * 0.92,
            width, height * 0.86
        );
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
