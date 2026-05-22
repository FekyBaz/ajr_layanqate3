/**
 * LeafSystem.js (Upgraded Cinematic Version)
 * Employs offscreen canvas pre-rendering to cache foliage asset textures.
 * Dramatically accelerates drawing performance to maintain solid 60fps on mobile.
 */

export class LeafSystem {
    constructor() {
        this.leafHues = [138, 145, 152, 160]; // emerald, mint, sage, and forest green
        
        // Set up offscreen canvas cache (512x128 sprite sheet for high-DPI quality with no clipping)
        this.spriteCanvas = document.createElement('canvas');
        this.spriteCanvas.width = 512;
        this.spriteCanvas.height = 128;
        this.sCtx = this.spriteCanvas.getContext('2d');
        
        // Define coordinates on our upscaled sprite sheet (128x128 bounds)
        this.sprites = {
            leafSage:    { x: 0,   y: 0, w: 128, h: 128 },
            leafEmerald: { x: 128,  y: 0, w: 128, h: 128 },
            starGold:    { x: 256, y: 0, w: 128, h: 128 },
            flowerWhite: { x: 384, y: 0, w: 128, h: 128 }
        };

        this.preRenderSprites();
    }

    /**
     * Draws beautiful vector graphics onto the offscreen canvas sprite sheet once.
     */
    preRenderSprites() {
        const ctx = this.sCtx;
        ctx.clearRect(0, 0, 512, 128);

        // --- 1. RENDER LEAF SAGE ---
        ctx.save();
        ctx.translate(64, 64);
        this.drawVectorLeaf(ctx, 142, 42, 55); // Sage green, high-DPI size 55
        ctx.restore();

        // --- 2. RENDER LEAF EMERALD ---
        ctx.save();
        ctx.translate(192, 64);
        this.drawVectorLeaf(ctx, 155, 36, 55); // Vibrant emerald green, high-DPI size 55
        ctx.restore();

        // --- 3. RENDER GOLD DIAMOND STAR ---
        ctx.save();
        ctx.translate(320, 64);
        this.drawVectorStar(ctx, 25); // Diamond flare, size 25
        ctx.restore();

        // --- 4. RENDER WHITE FLOWER BLOSSOM ---
        ctx.save();
        ctx.translate(448, 64);
        this.drawVectorFlower(ctx, 22); // Jasmine blossom, size 22
        ctx.restore();
    }

    /**
     * Draws vector leaf path using advanced Bezier curves, radial halos, gradients, and veins
     */
    drawVectorLeaf(ctx, hue, lightness, size) {
        // 1. Soft radial background glow (backplate shadow) - blends emerald and twilight gold
        const glowGrad = ctx.createRadialGradient(size * 0.5, 0, 2, size * 0.5, 0, size * 0.95);
        glowGrad.addColorStop(0, `hsla(${hue + 10}, 85%, 60%, 0.32)`); // Glowing core
        glowGrad.addColorStop(0.4, `hsla(${hue}, 75%, 45%, 0.14)`);   // Ambient emerald halo
        glowGrad.addColorStop(0.8, `rgba(200, 166, 115, 0.08)`);       // Soft twilight gold bleeding
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(size * 0.5, 0, size * 0.95, 0, Math.PI * 2);
        ctx.fill();

        // 2. Main Leaf Silhouette using Dual Bezier Curves - plumper organic shape
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(size * 0.18, -size * 0.52, size * 0.72, -size * 0.45, size, 0);
        ctx.bezierCurveTo(size * 0.72, size * 0.45, size * 0.18, size * 0.52, 0, 0);
        ctx.closePath();

        // Volumetric base-to-tip HSL gradient with rich color progression
        const grad = ctx.createLinearGradient(0, 0, size, 0);
        grad.addColorStop(0, `hsl(${hue - 4}, 78%, ${lightness - 8}%)`); // Deep base
        grad.addColorStop(0.35, `hsl(${hue}, 70%, ${lightness}%)`);   // Rich green body
        grad.addColorStop(0.7, `hsl(${hue + 8}, 75%, ${lightness + 5}%)`); // Mid glow
        grad.addColorStop(1, `hsl(${hue + 16}, 90%, ${lightness + 12}%)`); // Radiant translucent tip

        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke Layer 1: Soft outer glowing edge aura (wider, softer)
        ctx.strokeStyle = `hsla(${hue + 15}, 90%, 68%, 0.30)`;
        ctx.lineWidth = size * 0.08;
        ctx.stroke();

        // Stroke Layer 2: Soft, organic semi-translucent boundary outline
        ctx.strokeStyle = `hsla(${hue}, 75%, ${lightness - 10}%, 0.85)`;
        ctx.lineWidth = 0.95;
        ctx.stroke();

        // 3. Delicate translucent center vein
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.02, size * 0.92, 0);
        ctx.strokeStyle = `hsla(${hue + 18}, 90%, ${lightness + 24}%, 0.65)`;
        ctx.lineWidth = size * 0.03;
        ctx.stroke();

        // 4. Fine lateral veins branching from center (very soft and subtle, organic angles)
        ctx.strokeStyle = `hsla(${hue + 18}, 85%, ${lightness + 20}%, 0.38)`;
        ctx.lineWidth = size * 0.016;
        
        // Lateral pair 1 (early branch)
        ctx.beginPath();
        ctx.moveTo(size * 0.22, -size * 0.01);
        ctx.quadraticCurveTo(size * 0.36, -size * 0.16, size * 0.46, -size * 0.25);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.22, size * 0.01);
        ctx.quadraticCurveTo(size * 0.36, size * 0.16, size * 0.46, size * 0.25);
        ctx.stroke();

        // Lateral pair 2 (mid branch)
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
     * Pre-rendered drawing of leaves with slow breathing sway
     */
    drawLeaf(ctx, x, y, angle, size, seed, breathingFactor, isInner = false, opacityScale = 1.0) {
        ctx.save();
        ctx.translate(x, y);
        
        // Dynamic, seed-derived unique phase shift for leaf breathing & swaying
        const leafPhase = (seed % 100) * 0.43;
        
        // Gentle organic independent swaying
        const sway = Math.sin(breathingFactor * 0.6 + leafPhase) * 0.05;
        ctx.rotate(angle + sway);

        // Subtly animate leaf size using breathing factor with unique phase
        const breathScale = 0.97 + Math.sin(breathingFactor * 0.8 + leafPhase * 1.2) * 0.03;
        const finalScale = (size / 55) * breathScale; // 55 is the high-DPI pre-rendered reference size
        ctx.scale(finalScale, finalScale);

        // Pick between Sage or Emerald sprite texture based on seed
        const sprite = (seed % 2 === 0) ? this.sprites.leafEmerald : this.sprites.leafSage;

        // Semi-transparent leaf layering to construct stunning 3D cinematic depth
        if (isInner) {
            ctx.globalAlpha = (0.28 + (seed % 3) * 0.05) * opacityScale; // softer, background depth layer
        } else {
            ctx.globalAlpha = (0.76 + (seed % 4) * 0.04) * opacityScale; // standard foliage layer
        }
        
        ctx.drawImage(
            this.spriteCanvas,
            sprite.x, sprite.y, sprite.w, sprite.h,
            -64, -64, 128, 128 // center drawn in upscaled coordinates
        );

        ctx.restore();
    }

    /**
     * Pre-rendered drawing of glittering golden stars
     */
    drawStar(ctx, x, y, size, pulse, seed, opacityScale = 1.0) {
        ctx.save();
        ctx.translate(x, y);

        const finalScale = (size / 25) * pulse; // 25 is the high-DPI pre-rendered star reference size
        ctx.scale(finalScale, finalScale);

        const sprite = this.sprites.starGold;
        
        // Twinkling shimmers (highly dimmed to keep stars as soft accent highlights)
        const twinkleOpacity = (0.15 + Math.sin(seed + pulse * 1.4) * 0.04) * opacityScale;
        ctx.globalAlpha = twinkleOpacity;

        // Draw extremely soft gold/bronze backing glow natively (quiet twilight accents)
        const radialGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
        radialGlow.addColorStop(0, 'rgba(200, 166, 115, 0.06)'); // Muted gold backing (halved)
        radialGlow.addColorStop(0.5, 'rgba(212, 175, 55, 0.015)');
        radialGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
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
