/**
 * LeafSystem.js (Upgraded Cinematic Version)
 * Employs offscreen canvas pre-rendering to cache foliage asset textures.
 * Dramatically accelerates drawing performance to maintain solid 60fps on mobile.
 */

export class LeafSystem {
    constructor() {
        this.leafHues = [138, 145, 152, 160]; // emerald, mint, sage, and forest green
        
        // Set up offscreen canvas cache (256x64 sprite sheet)
        this.spriteCanvas = document.createElement('canvas');
        this.spriteCanvas.width = 256;
        this.spriteCanvas.height = 64;
        this.sCtx = this.spriteCanvas.getContext('2d');
        
        // Define coordinates on our sprite sheet
        this.sprites = {
            leafSage:    { x: 0,   y: 0, w: 64, h: 64 },
            leafEmerald: { x: 64,  y: 0, w: 64, h: 64 },
            starGold:    { x: 128, y: 0, w: 64, h: 64 },
            flowerWhite: { x: 192, y: 0, w: 64, h: 64 }
        };

        this.preRenderSprites();
    }

    /**
     * Draws beautiful vector graphics onto the offscreen canvas sprite sheet once.
     */
    preRenderSprites() {
        const ctx = this.sCtx;
        ctx.clearRect(0, 0, 256, 64);

        // --- 1. RENDER LEAF SAGE ---
        ctx.save();
        ctx.translate(32, 32);
        this.drawVectorLeaf(ctx, 142, 42, 22); // Sage green, size 22
        ctx.restore();

        // --- 2. RENDER LEAF EMERALD ---
        ctx.save();
        ctx.translate(96, 32);
        this.drawVectorLeaf(ctx, 155, 36, 22); // Vibrant emerald green, size 22
        ctx.restore();

        // --- 3. RENDER GOLD DIAMOND STAR ---
        ctx.save();
        ctx.translate(160, 32);
        this.drawVectorStar(ctx, 15); // Diamond flare, size 15
        ctx.restore();

        // --- 4. RENDER WHITE FLOWER BLOSSOM ---
        ctx.save();
        ctx.translate(224, 32);
        this.drawVectorFlower(ctx, 12); // Jasmine blossom, size 12
        ctx.restore();
    }

    /**
     * Draws vector leaf path using bezier curves
     */
    drawVectorLeaf(ctx, hue, lightness, size) {
        const fillColor = `hsl(${hue}, 64%, ${lightness}%)`;
        const strokeColor = `hsl(${hue}, 70%, ${lightness - 10}%)`;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.45, size, 0);
        ctx.quadraticCurveTo(size * 0.5, size * 0.45, 0, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, -size * 0.35, size, size * 0.35);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, `hsl(${hue - 6}, 56%, ${lightness - 6}%)`);

        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    /**
     * Draws vector 4-pointed golden diamond star
     */
    drawVectorStar(ctx, size) {
        // Metallic golden gradient
        const metallicGold = ctx.createLinearGradient(-size, -size, size, size);
        metallicGold.addColorStop(0, '#fbf2d8'); // highlights
        metallicGold.addColorStop(0.4, '#c8a673'); // mid gold
        metallicGold.addColorStop(1, '#8c6a35'); // deep bronze shadows

        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.quadraticCurveTo(0, 0, size, 0);
        ctx.quadraticCurveTo(0, 0, 0, size);
        ctx.quadraticCurveTo(0, 0, -size, 0);
        ctx.quadraticCurveTo(0, 0, 0, -size);
        ctx.closePath();

        ctx.fillStyle = metallicGold;
        ctx.fill();

        // Center sparkle core
        ctx.fillStyle = '#ffffff';
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
    drawLeaf(ctx, x, y, angle, size, seed, breathingFactor) {
        ctx.save();
        ctx.translate(x, y);
        // Combine branch wind angle and leaf organic breathing sway
        const sway = Math.sin(breathingFactor + seed) * 0.08;
        ctx.rotate(angle + sway);

        // Subtly animate leaf size using the breathing factor
        const breathScale = 0.95 + Math.sin(breathingFactor + seed * 1.5) * 0.05;
        const finalScale = (size / 22) * breathScale;
        ctx.scale(finalScale, finalScale);

        // Pick between Sage or Emerald sprite texture based on seed
        const sprite = (seed % 2 === 0) ? this.sprites.leafEmerald : this.sprites.leafSage;

        // Semi-translucent layered rendering for organic depth
        ctx.globalAlpha = 0.72 + (seed % 4) * 0.04;
        
        ctx.drawImage(
            this.spriteCanvas,
            sprite.x, sprite.y, sprite.w, sprite.h,
            -32, -32, 64, 64 // center drawn
        );

        ctx.restore();
    }

    /**
     * Pre-rendered drawing of glittering golden stars
     */
    drawStar(ctx, x, y, size, pulse, seed) {
        ctx.save();
        ctx.translate(x, y);

        const finalScale = (size / 15) * pulse;
        ctx.scale(finalScale, finalScale);

        const sprite = this.sprites.starGold;
        
        //Twinkling shimmers
        const twinkleOpacity = 0.82 + Math.sin(seed + pulse * 1.4) * 0.12;
        ctx.globalAlpha = twinkleOpacity;

        // Draw soft golden backing glow natively
        const radialGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
        radialGlow.addColorStop(0, 'rgba(200, 166, 115, 0.35)');
        radialGlow.addColorStop(0.5, 'rgba(212, 175, 55, 0.1)');
        radialGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(
            this.spriteCanvas,
            sprite.x, sprite.y, sprite.w, sprite.h,
            -32, -32, 64, 64
        );

        ctx.restore();
    }

    /**
     * Pre-rendered drawing of yasmine flowers
     */
    drawFlower(ctx, x, y, size, rotation, breathingFactor, seed) {
        ctx.save();
        ctx.translate(x, y);
        
        // Flower scales softly with breathing wave
        const breathScale = 0.96 + Math.sin(breathingFactor + seed * 2.0) * 0.04;
        const finalScale = (size / 12) * breathScale;
        ctx.scale(finalScale, finalScale);
        ctx.rotate(rotation);

        const sprite = this.sprites.flowerWhite;
        ctx.globalAlpha = 0.88;

        ctx.drawImage(
            this.spriteCanvas,
            sprite.x, sprite.y, sprite.w, sprite.h,
            -32, -32, 64, 64
        );

        ctx.restore();
    }
}
