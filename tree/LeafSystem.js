/**
 * LeafSystem.js
 * Renders the beautiful, organic foliage: green leaves, golden diamond stars, and soft blossoms.
 */

export class LeafSystem {
    constructor() {
        // Pre-computed organic values for leaf colors to ensure variation without heavy calculations
        this.leafHues = [135, 142, 148, 154, 160]; // beautiful shades of emerald and sage green
    }

    /**
     * Renders a highly elegant, organic leaf using smooth Bezier curves.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x - position X
     * @param {number} y - position Y
     * @param {number} angle - rotation angle in radians
     * @param {number} size - leaf size multiplier
     * @param {number} seed - random index for color variations
     */
    drawLeaf(ctx, x, y, angle, size, seed) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Pick organic emerald-green colors
        const hue = this.leafHues[seed % this.leafHues.length];
        const lightness = 35 + (seed % 10); // subtle lightness variations
        const fillColor = `hsl(${hue}, 68%, ${lightness}%)`;
        const strokeColor = `hsl(${hue}, 75%, ${lightness - 10}%)`;

        ctx.beginPath();
        // Pointed leaf path using quadratic curves
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(size * 0.5, -size * 0.4, size, 0);
        ctx.quadraticCurveTo(size * 0.5, size * 0.4, 0, 0);
        ctx.closePath();

        // Premium soft gradient fill
        const grad = ctx.createLinearGradient(0, -size * 0.3, size, size * 0.3);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, `hsl(${hue - 8}, 60%, ${lightness - 6}%)`);

        ctx.fillStyle = grad;
        ctx.fill();

        // Extremely soft outline to look premium
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Renders a glowing golden star (Diamond Flare style - ✦) matching Islamic minimalist aesthetics.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     * @param {number} pulse - time-based pulse modifier [0.8 to 1.2]
     * @param {number} seed 
     */
    drawStar(ctx, x, y, size, pulse, seed) {
        ctx.save();
        ctx.translate(x, y);

        const currentSize = size * pulse;
        const opacity = 0.85 + Math.sin(seed + pulse) * 0.1;

        // Soft golden glow circle behind the star
        const radialGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSize * 2.5);
        radialGlow.addColorStop(0, `rgba(200, 166, 115, ${0.38 * opacity})`);
        radialGlow.addColorStop(0.4, `rgba(212, 175, 55, ${0.12 * opacity})`);
        radialGlow.addColorStop(1, 'rgba(212, 175, 55, 0)');
        
        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(0, 0, currentSize * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 4-Pointed premium diamond star
        ctx.beginPath();
        ctx.moveTo(0, -currentSize); // top
        ctx.quadraticCurveTo(0, 0, currentSize, 0); // top-right bend
        ctx.quadraticCurveTo(0, 0, 0, currentSize); // bottom-right bend
        ctx.quadraticCurveTo(0, 0, -currentSize, 0); // bottom-left bend
        ctx.quadraticCurveTo(0, 0, 0, -currentSize); // top-left bend
        ctx.closePath();

        // Gold metallic gradient
        const metallicGold = ctx.createLinearGradient(-currentSize, -currentSize, currentSize, currentSize);
        metallicGold.addColorStop(0, '#f0dfc1'); // Warm soft gold highlight
        metallicGold.addColorStop(0.5, '#c8a673'); // Deep gold base
        metallicGold.addColorStop(1, '#8c6a35'); // Shaded bronze

        ctx.fillStyle = metallicGold;
        ctx.fill();

        // Center bright sparkle dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, currentSize * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Renders a soft, pure cherry blossom / star jasmine flower.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} size 
     * @param {number} rotation 
     */
    drawFlower(ctx, x, y, size, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        const petalsCount = 5;
        const petalAngle = (Math.PI * 2) / petalsCount;

        // Draw 5 smooth, delicate white-lilac petals
        for (let i = 0; i < petalsCount; i++) {
            ctx.rotate(petalAngle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            // Elegant teardrop petal shape
            ctx.bezierCurveTo(-size * 0.4, -size * 0.8, size * 0.4, -size * 0.8, 0, 0);
            ctx.closePath();

            // Soft white/pale rose gradient
            const petalGrad = ctx.createLinearGradient(0, -size * 0.8, 0, 0);
            petalGrad.addColorStop(0, '#ffffff');
            petalGrad.addColorStop(0.7, '#fff5f5');
            petalGrad.addColorStop(1, '#ebdcd5'); // Soft beige shadow at core

            ctx.fillStyle = petalGrad;
            ctx.fill();
        }

        // Draw the golden-amber flower core
        ctx.fillStyle = '#c8a673';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Core highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-size * 0.05, -size * 0.05, size * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
