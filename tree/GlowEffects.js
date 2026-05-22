/**
 * GlowEffects.js
 * Manages atmospheric lighting, ambient radial golds, and manages blending modes.
 */

export class GlowEffects {
    constructor() {}

    /**
     * Draws a subtle spiritual twilight atmosphere in the background of the tree container
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} width 
     * @param {number} height 
     */
    drawBackgroundAtmosphere(ctx, width, height) {
        ctx.save();
        
        // Deep twilight indigo gradient fading into a soft golden horizon at the bottom
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0c1220');      // Deep navy/indigo cosmic color
        bgGrad.addColorStop(0.5, '#121f2f');    // Deep spiritual teal-navy
        bgGrad.addColorStop(1, '#1b2d3c');      // Ambient navy-blue at the base

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Ambient radial light right behind the tree center
        const centerX = width / 2;
        const centerY = height * 0.55;
        const radialGlow = ctx.createRadialGradient(
            centerX, centerY, 5, 
            centerX, centerY, Math.min(width, height) * 0.75
        );
        // Soft glowing gold halo
        radialGlow.addColorStop(0, 'rgba(200, 166, 115, 0.16)');
        radialGlow.addColorStop(0.3, 'rgba(140, 106, 53, 0.06)');
        radialGlow.addColorStop(0.7, 'rgba(27, 45, 60, 0.02)');
        radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.min(width, height) * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Sets Canvas blending mode to 'screen' for vibrant overlay glow effects
     * @param {CanvasRenderingContext2D} ctx 
     */
    enableGlowMode(ctx) {
        ctx.globalCompositeOperation = 'screen';
    }

    /**
     * Resets Canvas blending mode to standard 'source-over'
     * @param {CanvasRenderingContext2D} ctx 
     */
    disableGlowMode(ctx) {
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Draws an elegant light aura around specific points (like newly sprouted branches or clicks)
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} radius 
     * @param {string} color - rgba string
     */
    drawPointGlow(ctx, x, y, radius, color) {
        ctx.save();
        this.enableGlowMode(ctx);

        const radialGlow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        radialGlow.addColorStop(0, color);
        radialGlow.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
