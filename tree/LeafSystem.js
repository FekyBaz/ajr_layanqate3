/**
 * LeafSystem.js (Upgraded Cinematic Version)
 * Employs offscreen canvas pre-rendering to cache foliage asset textures.
 * Dramatically accelerates drawing performance to maintain solid 60fps on mobile.
 */

export class LeafSystem {
    constructor() {
        this.leafHues = [138, 145, 152, 160]; // emerald, mint, sage, and forest green
        
        // Set up offscreen canvas cache (768x128 sprite sheet for high-DPI quality with no clipping)
        this.spriteCanvas = document.createElement('canvas');
        this.spriteCanvas.width = 768;
        this.spriteCanvas.height = 128;
        this.sCtx = this.spriteCanvas.getContext('2d');
        
        // Define coordinates on our upscaled sprite sheet (128x128 bounds)
        this.sprites = {
            leafBack:    { x: 0,   y: 0, w: 128, h: 128 },
            leafMid:     { x: 128, y: 0, w: 128, h: 128 },
            leafFront:   { x: 256, y: 0, w: 128, h: 128 },
            starGold:    { x: 384, y: 0, w: 128, h: 128 },
            flowerWhite: { x: 512, y: 0, w: 128, h: 128 }
        };

        this.preRenderSprites();
    }

    /**
     * Draws beautiful vector graphics onto the offscreen canvas sprite sheet once.
     */
    preRenderSprites() {
        const ctx = this.sCtx;
        ctx.clearRect(0, 0, 768, 128);

        // --- 1. RENDER LEAF BACK ---
        ctx.save();
        ctx.translate(64, 64);
        this.drawVectorLeafBack(ctx, 55); // Sage green, size 55
        ctx.restore();

        // --- 2. RENDER LEAF MID ---
        ctx.save();
        ctx.translate(192, 64);
        this.drawVectorLeafMid(ctx, 55); // Rich green sage, size 55
        ctx.restore();

        // --- 3. RENDER LEAF FRONT ---
        ctx.save();
        ctx.translate(320, 64);
        this.drawVectorLeafFront(ctx, 55); // Vibrant emerald green, size 55
        ctx.restore();

        // --- 4. RENDER GOLD DIAMOND STAR ---
        ctx.save();
        ctx.translate(448, 64);
        this.drawVectorStar(ctx, 25); // Diamond flare, size 25
        ctx.restore();

        // --- 5. RENDER WHITE FLOWER BLOSSOM ---
        ctx.save();
        ctx.translate(576, 64);
        this.drawVectorFlower(ctx, 22); // Jasmine blossom, size 22
        ctx.restore();
    }

    /**
     * BACK LAYER LEAF: Dark, desaturated, soft dark border, no glow, thin center vein, no lateral veins
     */
    drawVectorLeafBack(ctx, size) {
        const hue = 138;
        const saturation = "18%"; // desaturated
        const lightness = 22;     // darkened for depth haze

        // Pre-render soft drop shadow for depth atmospheric blending
        ctx.shadowColor = 'rgba(11, 20, 36, 0.45)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;

        // Silhouette using Bezier Curves - thinner profile (reduced roundness)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(size * 0.18, -size * 0.42, size * 0.72, -size * 0.35, size, 0);
        ctx.bezierCurveTo(size * 0.72, size * 0.35, size * 0.18, size * 0.42, 0, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, size, 0);
        grad.addColorStop(0, `hsl(${hue - 4}, ${saturation}, ${lightness - 6}%)`); // Very dark base
        grad.addColorStop(0.5, `hsl(${hue}, ${saturation}, ${lightness}%)`);
        grad.addColorStop(1, `hsl(${hue + 6}, ${saturation}, ${lightness + 4}%)`);

        ctx.fillStyle = grad;
        ctx.fill();

        // Single thin dark border (no glowing aura!)
        ctx.strokeStyle = `hsla(${hue}, ${saturation}, ${lightness - 10}%, 0.65)`;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Very thin, translucent center vein
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.01, size * 0.90, 0);
        ctx.strokeStyle = `hsla(${hue + 10}, 30%, ${lightness + 12}%, 0.45)`;
        ctx.lineWidth = size * 0.02;
        ctx.stroke();
    }

    /**
     * MID LAYER LEAF: Standard balanced sage/emerald, thin profile, catch moonlight on upper edge
     */
    drawVectorLeafMid(ctx, size) {
        const hue = 145; // balanced sage green
        const saturation = "52%";
        const lightness = 35;

        // Pre-render soft drop shadow for depth blending
        ctx.shadowColor = 'rgba(8, 14, 25, 0.35)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1.5;

        // Silhouette - thinner profile
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(size * 0.18, -size * 0.44, size * 0.72, -size * 0.37, size, 0);
        ctx.bezierCurveTo(size * 0.72, size * 0.37, size * 0.18, size * 0.44, 0, 0);
        ctx.closePath();

        // Diagonal gradient catching moonlight on upper left (0, -0.18) to shaded lower right (size, 0.22)
        const grad = ctx.createLinearGradient(0, -size * 0.18, size, size * 0.22);
        grad.addColorStop(0, `hsl(42, 45%, 62%)`); // Cream-gold moonlight specular catch on upper edge
        grad.addColorStop(0.4, `hsl(${hue}, ${saturation}, ${lightness}%)`);
        grad.addColorStop(1, `hsl(${hue - 4}, ${saturation - 10}%, ${lightness - 6}%)`); // Shaded lower side

        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke Layer 1: Extremely faint soft edge aura (reduced to 0.05 opacity)
        ctx.strokeStyle = `hsla(${hue + 12}, 70%, 55%, 0.05)`;
        ctx.lineWidth = size * 0.03;
        ctx.stroke();

        // Stroke Layer 2: standard crisp boundary outline
        ctx.strokeStyle = `hsla(${hue}, 60%, ${lightness - 10}%, 0.75)`;
        ctx.lineWidth = 0.95;
        ctx.stroke();

        // Translucent center vein
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.02, size * 0.92, 0);
        ctx.strokeStyle = `hsla(${hue + 15}, 70%, ${lightness + 18}%, 0.5)`;
        ctx.lineWidth = size * 0.025;
        ctx.stroke();

        // Soft lateral veins
        ctx.strokeStyle = `hsla(${hue + 15}, 60%, ${lightness + 15}%, 0.25)`;
        ctx.lineWidth = size * 0.015;
        
        ctx.beginPath();
        ctx.moveTo(size * 0.25, -size * 0.01);
        ctx.quadraticCurveTo(size * 0.38, -size * 0.15, size * 0.48, -size * 0.22);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.25, size * 0.01);
        ctx.quadraticCurveTo(size * 0.38, size * 0.15, size * 0.48, size * 0.22);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.55, 0);
        ctx.quadraticCurveTo(size * 0.68, -size * 0.10, size * 0.78, -size * 0.18);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.55, 0);
        ctx.quadraticCurveTo(size * 0.68, size * 0.10, size * 0.78, size * 0.18);
        ctx.stroke();
    }

    /**
     * FRONT LAYER LEAF: Plump yet sleek, vibrant emerald, crisp details, catching specular moonlight
     */
    drawVectorLeafFront(ctx, size) {
        const hue = 152; // rich vibrant emerald
        const saturation = "78%";
        const lightness = 42;

        // Pre-render soft drop shadow for depth blending
        ctx.shadowColor = 'rgba(6, 10, 20, 0.30)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0.5;
        ctx.shadowOffsetY = 1;

        // Silhouette using Bezier Curves - elegant thin organic shape (reduced roundness)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(size * 0.18, -size * 0.45, size * 0.72, -size * 0.38, size, 0);
        ctx.bezierCurveTo(size * 0.72, size * 0.38, size * 0.18, size * 0.45, 0, 0);
        ctx.closePath();

        // Diagonal gradient catching warm specular cream-gold moonlight highlight
        const grad = ctx.createLinearGradient(0, -size * 0.2, size, size * 0.25);
        grad.addColorStop(0, `hsl(42, 60%, 72%)`); // Specular cream-gold upper highlight
        grad.addColorStop(0.3, `hsl(${hue}, ${saturation}, ${lightness}%)`);
        grad.addColorStop(0.8, `hsl(${hue - 4}, ${saturation}, ${lightness - 8}%)`);
        grad.addColorStop(1, `hsl(${hue - 8}, ${saturation - 10}%, ${lightness - 12}%)`); // Shaded lower side

        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke Layer 1: extremely narrow/subtle highlight rim (reduced to 0.03 opacity)
        ctx.strokeStyle = `hsla(${hue + 15}, 90%, 68%, 0.03)`;
        ctx.lineWidth = size * 0.02;
        ctx.stroke();

        // Stroke Layer 2: standard crisp boundary outline
        ctx.strokeStyle = `hsla(${hue}, 80%, ${lightness - 12}%, 0.85)`;
        ctx.lineWidth = 0.95;
        ctx.stroke();

        // Translucent center vein
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.02, size * 0.92, 0);
        ctx.strokeStyle = `hsla(${hue + 18}, 90%, ${lightness + 22}%, 0.65)`;
        ctx.lineWidth = size * 0.03;
        ctx.stroke();

        // Crisp lateral veins
        ctx.strokeStyle = `hsla(${hue + 18}, 80%, ${lightness + 18}%, 0.38)`;
        ctx.lineWidth = size * 0.016;

        ctx.beginPath();
        ctx.moveTo(size * 0.22, -size * 0.01);
        ctx.quadraticCurveTo(size * 0.36, -size * 0.16, size * 0.46, -size * 0.25);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.22, size * 0.01);
        ctx.quadraticCurveTo(size * 0.36, size * 0.16, size * 0.46, size * 0.25);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.52, 0);
        ctx.quadraticCurveTo(size * 0.66, -size * 0.12, size * 0.76, -size * 0.20);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.52, 0);
        ctx.quadraticCurveTo(size * 0.66, size * 0.12, size * 0.76, size * 0.20);
        ctx.stroke();
    }

    /**
     * Draws vector 4-pointed golden diamond star (softened highlights)
     */
    drawVectorStar(ctx, size) {
        // Softened golden gradient to reduce visual glare
        const metallicGold = ctx.createLinearGradient(-size, -size, size, size);
        metallicGold.addColorStop(0, '#e5d3b3'); // Softer cream gold
        metallicGold.addColorStop(0.5, '#b8945f'); // Warm mid brass
        metallicGold.addColorStop(1, '#785628'); // Muted bronze shadow

        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.quadraticCurveTo(0, 0, size, 0);
        ctx.quadraticCurveTo(0, 0, 0, size);
        ctx.quadraticCurveTo(0, 0, -size, 0);
        ctx.quadraticCurveTo(0, 0, 0, -size);
        ctx.closePath();

        ctx.fillStyle = metallicGold;
        ctx.fill();

        // Center sparkle core (toned down to soft cream gold highlight)
        ctx.fillStyle = '#fbf2d8';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draws vector 5-petal white cherry blossom
     */
    drawVectorFlower(ctx, size) {
        const petals = 5;
        const angle = (Math.PI * 2) / petals;

        for (let i = 0; i < petals; i++) {
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-size * 0.4, -size * 0.82, size * 0.4, -size * 0.82, 0, 0);
            ctx.closePath();

            const petalGrad = ctx.createLinearGradient(0, -size * 0.8, 0, 0);
            petalGrad.addColorStop(0, '#ffffff');
            petalGrad.addColorStop(0.7, '#fff5f2');
            petalGrad.addColorStop(1, '#ebe0d7');

            ctx.fillStyle = petalGrad;
            ctx.fill();
        }

        // Amber core
        ctx.fillStyle = '#c8a673';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Pre-rendered drawing of leaves with slow breathing sway and layer selection
     */
    drawLeaf(ctx, x, y, angle, size, seed, breathingFactor, layerName = 'mid', opacityScale = 1.0) {
        ctx.save();
        ctx.translate(x, y);
        
        // Dynamic, seed-derived unique phase shift for leaf breathing & swaying
        const leafPhase = (seed % 100) * 0.43;
        
        // Gentle organic independent swaying
        const sway = Math.sin(breathingFactor * 0.6 + leafPhase) * 0.05;
        
        // permanent random rotation to differentiate leaf silhouettes
        const randomRotation = ((seed % 13) / 13 - 0.5) * 0.45;
        ctx.rotate(angle + sway + randomRotation);

        // Subtly animate leaf size using breathing factor with unique phase
        const breathScale = 0.97 + Math.sin(breathingFactor * 0.8 + leafPhase * 1.2) * 0.03;
        
        // permanent random scale based on seed for organic variety
        const randomScale = 0.88 + (seed % 7) * 0.04;
        const finalScale = (size / 55) * breathScale * randomScale; // 55 is the high-DPI pre-rendered reference size
        ctx.scale(finalScale, finalScale);

        // Pick sprite texture and target opacity based on layerName
        let sprite;
        let layerOpacity;
        if (layerName === 'back') {
            sprite = this.sprites.leafBack;
            layerOpacity = (0.22 + (seed % 3) * 0.04) * opacityScale;
        } else if (layerName === 'front') {
            sprite = this.sprites.leafFront;
            layerOpacity = (0.78 + (seed % 3) * 0.05) * opacityScale;
        } else {
            sprite = this.sprites.leafMid;
            layerOpacity = (0.55 + (seed % 4) * 0.05) * opacityScale;
        }
        
        ctx.globalAlpha = layerOpacity;
        
        ctx.drawImage(
            this.spriteCanvas,
            sprite.x, sprite.y, sprite.w, sprite.h,
            -64, -64, 128, 128 // center drawn in upscaled coordinates
        );

        ctx.restore();
    }

    /**
     * Pre-rendered drawing of glittering golden stars (firefly shimmers)
     */
    drawStar(ctx, x, y, size, pulse, seed, opacityScale = 1.0) {
        ctx.save();
        ctx.translate(x, y);

        const finalScale = (size / 25) * pulse; // 25 is the high-DPI pre-rendered star reference size
        ctx.scale(finalScale, finalScale);

        const sprite = this.sprites.starGold;
        
        // Twinkling shimmers (quiet but clearly visible golden sparkles) - Asynchronous, irregular frequency
        const speedFactor = 0.0007 + (seed % 9) * 0.0002;
        const starTime = Date.now() * speedFactor;
        const twinkleOpacity = (0.42 + Math.sin(starTime + (seed * 1.7)) * 0.18) * opacityScale;
        ctx.globalAlpha = twinkleOpacity;

        // Draw extremely soft gold/bronze backing glow natively (quiet twilight accents, reduced glare)
        const radialGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
        radialGlow.addColorStop(0, 'rgba(200, 166, 115, 0.08)'); // Muted gold backing (quieter)
        radialGlow.addColorStop(0.5, 'rgba(212, 175, 55, 0.02)');
        radialGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(
            this.spriteCanvas,
            sprite.x, sprite.y, sprite.w, sprite.h,
            -64, -64, 128, 128
        );

        ctx.restore();
    }

    /**
     * Pre-rendered drawing of jasmine flowers
     */
    drawFlower(ctx, x, y, size, rotation, breathingFactor, seed) {
        ctx.save();
        ctx.translate(x, y);
        
        // Flower scales softly with breathing wave
        const breathScale = 0.96 + Math.sin(breathingFactor + seed * 2.0) * 0.04;
        const finalScale = (size / 22) * breathScale; // 22 is the pre-rendered reference size
        ctx.scale(finalScale, finalScale);
        ctx.rotate(rotation);

        const sprite = this.sprites.flowerWhite;
        ctx.globalAlpha = 0.88;

        ctx.drawImage(
            this.spriteCanvas,
            sprite.x, sprite.y, sprite.w, sprite.h,
            -64, -64, 128, 128
        );

        ctx.restore();
    }
}
