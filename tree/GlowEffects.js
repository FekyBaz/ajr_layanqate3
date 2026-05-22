/**
 * GlowEffects.js (Upgraded Cinematic Version)
 * Implements multi-layered horizontal atmospheric fog bands, radial vignette overlays,
 * and cinematic ambient lighting behind the spiritual canopy.
 */

export class GlowEffects {
    constructor() {
        this.fogTime = 0;
    }

    /**
     * Primary background atmosphere drawing call with dynamic spiritual aura
     */
    drawBackgroundAtmosphere(ctx, width, height, state = null) {
        ctx.save();
        
        // 1. Deep cosmic spiritual night sky gradient backing
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#060a12');      // Cosmic deep space black-navy
        skyGrad.addColorStop(0.5, '#0b1424');    // Deep midnight teal
        skyGrad.addColorStop(1, '#111f32');      // Soft navy blue ground

        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Calculate dynamic Spiritual Aura expansion & warmth based on stats
        const totalActivity = state ? (state.rawStats.dhikr + state.rawStats.shares) : 0;
        const auraGrowth = Math.min(1.0, totalActivity / 400); // asymptotic normalization capped at 400 activities

        // 2. Majestic radial halo right behind the spiritual tree center (grows in size and warm golden radiance)
        const centerX = width / 2;
        const centerY = height * 0.52;
        const haloRadius = Math.min(width, height) * (0.75 + auraGrowth * 0.20);
        const radialGlow = ctx.createRadialGradient(
            centerX, centerY, 5, 
            centerX, centerY, haloRadius
        );
        radialGlow.addColorStop(0, `rgba(220, 175, 110, ${0.18 + auraGrowth * 0.16})`); // warm radiant golden heart
        radialGlow.addColorStop(0.28, `rgba(150, 115, 60, ${0.07 + auraGrowth * 0.08})`); // deep cosmic gold glow
        radialGlow.addColorStop(0.65, 'rgba(17, 31, 50, 0.02)');
        radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // 3. Draw multi-layered horizontal atmospheric fog with dynamic warmth
        this.drawAtmosphereFog(ctx, width, height, auraGrowth);

        ctx.restore();
    }

    /**
     * Renders drifting horizontal bands of soft twilight mist for cinematic depth
     */
    drawAtmosphereFog(ctx, width, height, auraGrowth = 0.0) {
        this.fogTime += 0.005; // calm, peaceful progression

        ctx.save();
        this.enableGlowMode(ctx);

        // --- LAYER 1: Deep Ground Mist (Fades the root structure) ---
        const groundGrad = ctx.createLinearGradient(0, height * 0.7, 0, height);
        groundGrad.addColorStop(0, 'rgba(11, 20, 36, 0)');
        groundGrad.addColorStop(0.5, 'rgba(27, 45, 70, 0.12)'); // subtle blue fog
        groundGrad.addColorStop(1, `rgba(220, 175, 110, ${0.04 + auraGrowth * 0.08})`); // warmer golden horizon edge

        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, height * 0.7, width, height * 0.3);

        // --- LAYER 2: Floating Ambient Mid-Canopy Mist Bands ---
        const waveY1 = height * 0.55 + Math.sin(this.fogTime) * 15;
        const mistGrad1 = ctx.createLinearGradient(0, waveY1 - 50, 0, waveY1 + 50);
        mistGrad1.addColorStop(0, 'rgba(27, 45, 70, 0)');
        mistGrad1.addColorStop(0.5, `rgba(220, 175, 110, ${0.03 + auraGrowth * 0.05})`); // dynamic soft golden mist
        mistGrad1.addColorStop(1, 'rgba(27, 45, 70, 0)');

        ctx.fillStyle = mistGrad1;
        ctx.fillRect(0, waveY1 - 50, width, 100);

        const waveY2 = height * 0.35 + Math.cos(this.fogTime * 0.75) * 12;
        const mistGrad2 = ctx.createLinearGradient(0, waveY2 - 40, 0, waveY2 + 40);
        mistGrad2.addColorStop(0, 'rgba(11, 20, 36, 0)');
        mistGrad2.addColorStop(0.5, 'rgba(27, 45, 70, 0.05)'); // soft twilight teal mist
        mistGrad2.addColorStop(1, 'rgba(11, 20, 36, 0)');

        ctx.fillStyle = mistGrad2;
        ctx.fillRect(0, waveY2 - 40, width, 80);

        this.disableGlowMode(ctx);
        ctx.restore();
    }

    /**
     * Renders a soft, rich dark vignette overlay around the canvas margins
     */
    drawVignetteOverlay(ctx, width, height) {
        ctx.save();
        this.enableGlowMode(ctx);

        const cx = width / 2;
        const cy = height / 2;
        const vignette = ctx.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.8, cx, cy, Math.max(cx, cy) * 1.3);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(0.6, 'rgba(6, 10, 18, 0.15)');
        vignette.addColorStop(1, 'rgba(4, 6, 10, 0.65)'); // thick cinematic vignette edges

        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        this.disableGlowMode(ctx);
        ctx.restore();
    }

    /**
     * Blending operations
     */
    enableGlowMode(ctx) {
        ctx.globalCompositeOperation = 'screen';
    }

    disableGlowMode(ctx) {
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Glowing focal spark flashes
     */
    drawPointGlow(ctx, x, y, radius, color) {
        ctx.save();
        this.enableGlowMode(ctx);

        const radialGlow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        radialGlow.addColorStop(0, color);
        radialGlow.addColorStop(0.3, color.replace(/[\d\.]+\)$/, '0.3)'));
        radialGlow.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = radialGlow;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        this.disableGlowMode(ctx);
        ctx.restore();
    }
}
