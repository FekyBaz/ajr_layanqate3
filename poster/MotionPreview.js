/**
 * أجر لا ينقطع - MotionPreview
 * Orchestrates lightweight, energy-efficient physics and particle render ticks.
 * Pauses automatically to preserve CPU cycle when page tab is backgrounded.
 */

export class MotionPreview {
    constructor() {
        this.particles = [];
        this.currentThemeId = null;
        this.activeScale = 1.0;
    }

    /**
     * Initializes the particles arrays with parameters matching the theme identity.
     */
    initParticles(theme, width, height) {
        this.particles = [];
        this.currentThemeId = theme.id;
        const scale = height / 1000;
        this.activeScale = scale;

        for (let i = 0; i < theme.particleCount; i++) {
            this.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: (1.2 + Math.random() * 2.6) * scale,
                speedX: (Math.random() - 0.5) * 0.22 * scale,
                speedY: -(0.08 + Math.random() * 0.35) * scale, // Drift upwards softly like spiritual seeds
                phase: Math.random() * Math.PI * 2,
                fadeSpeed: 0.006 + Math.random() * 0.012
            });
        }
    }

    /**
     * Updates coordinates and renders floating particle systems onto active contexts.
     */
    updateAndDrawParticles(ctx, theme, width, height) {
        const scale = height / 1000;
        
        // Re-initialize particles if theme changes or boundaries resize
        if (this.currentThemeId !== theme.id || this.particles.length === 0 || Math.abs(this.activeScale - scale) > 0.05) {
            this.initParticles(theme, width, height);
        }

        ctx.save();

        for (const p of this.particles) {
            // Apply physics sways relative to size scale
            p.x += p.speedX;
            p.y += p.speedY;

            // Boundary wrapping
            if (p.x < -20 * scale) p.x = width + 20 * scale;
            if (p.x > width + 20 * scale) p.x = -20 * scale;
            if (p.y < -20 * scale) p.y = height + 20 * scale;
            if (p.y > height + 20 * scale) p.y = -20 * scale;

            // Soft rhythmic breathing pulse using standard sine phase offsets
            p.phase += p.fadeSpeed;
            const liveAlpha = 0.12 + ((Math.sin(p.phase) + 1) * 0.5) * 0.45;

            ctx.fillStyle = theme.particleColor;
            ctx.globalAlpha = liveAlpha;

            if (theme.id === 'premium-gold') {
                // Twinkling luxury diamond sparkles!
                ctx.beginPath();
                const size = p.radius * 1.5;
                ctx.moveTo(p.x, p.y - size);
                ctx.lineTo(p.x + size, p.y);
                ctx.lineTo(p.x, p.y + size);
                ctx.lineTo(p.x - size, p.y);
                ctx.closePath();
                ctx.fill();
            } else {
                // Circular floating spiritual fireflies / seeds
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();

                // Draw elegant halo aura for larger fireflies
                if (p.radius > 2.0 * scale) {
                    ctx.save();
                    const auraGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3.5);
                    auraGrad.addColorStop(0, theme.particleColor);
                    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = auraGrad;
                    ctx.globalAlpha = liveAlpha * 0.35;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius * 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }
        }

        ctx.restore();
    }
}
