/**
 * TreePhysics.js
 * Implements wind sway dynamics and floating/shooting particle simulation.
 */

export class TreePhysics {
    constructor() {
        this.time = 0;
        this.windStrength = 0.05; // calm, peaceful sway
        this.windFrequency = 0.0015;

        // Ambient floating firefly particles
        this.ambientParticles = [];
        this.maxAmbient = 35;

        // Active shooting particles (triggered by user sharing)
        this.shootingParticles = [];
    }

    /**
     * Updates time and simulations
     * @param {number} width - canvas width
     * @param {number} height - canvas height
     */
    tick(width, height) {
        this.time += 16.67; // approx ms per frame at 60fps

        // Simulate wind sway factor (ranges from -1 to 1, slowly wandering)
        this.currentWind = Math.sin(this.time * this.windFrequency) * Math.cos(this.time * this.windFrequency * 0.7) * this.windStrength;

        // Update ambient firefly particles
        this.updateAmbient(width, height);

        // Update shooting particles
        this.updateShooting();
    }

    /**
     * Returns wind angle offset for a branch at a given height fraction (0 = trunk base, 1 = topmost leaves)
     * @param {number} heightFraction 
     */
    getWindSway(heightFraction) {
        // Upper branches sway much more than the base trunk
        const heightMultiplier = Math.pow(heightFraction, 1.8);
        // Add a slight phase shift based on height to make it feel organic, like a wave passing through the tree
        const phaseShift = Math.sin(this.time * 0.002 + heightFraction * 5.0) * 0.015;
        return (this.currentWind + phaseShift) * heightMultiplier;
    }

    /**
     * Ambient floating particles (peaceful fireflies)
     */
    updateAmbient(width, height) {
        // Spawn ambient particles if under capacity
        if (this.ambientParticles.length < this.maxAmbient && Math.random() < 0.03) {
            this.ambientParticles.push({
                x: Math.random() * width,
                y: height * 0.3 + Math.random() * height * 0.5,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -Math.random() * 0.4 - 0.1, // slowly floats upwards
                size: Math.random() * 2.5 + 1.0,
                color: Math.random() > 0.45 ? 'rgba(200, 166, 115, 0.45)' : 'rgba(39, 174, 96, 0.35)', // gold or emerald
                alpha: Math.random() * 0.7 + 0.1,
                birth: this.time,
                life: Math.random() * 12000 + 8000, // lives 8-20 seconds
                phase: Math.random() * Math.PI * 2
            });
        }

        // Update existing ones
        for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
            const p = this.ambientParticles[i];
            const age = this.time - p.birth;

            if (age >= p.life) {
                this.ambientParticles.splice(i, 1);
                continue;
            }

            // Sway movement
            p.x += p.vx + Math.sin(this.time * 0.001 + p.phase) * 0.15;
            p.y += p.vy;

            // Fade in at birth, fade out at death
            const lifeFraction = age / p.life;
            if (lifeFraction < 0.15) {
                p.currentAlpha = p.alpha * (lifeFraction / 0.15);
            } else if (lifeFraction > 0.8) {
                p.currentAlpha = p.alpha * ((1 - lifeFraction) / 0.2);
            } else {
                p.currentAlpha = p.alpha;
            }
        }
    }

    /**
     * Triggers a shooting star particle from the clicked share button up into the tree
     * @param {number} startX - source screen X
     * @param {number} startY - source screen Y
     * @param {number} targetX - tree branch target X
     * @param {number} targetY - tree branch target Y
     */
    spawnShootingParticle(startX, startY, targetX, targetY) {
        this.shootingParticles.push({
            startX,
            startY,
            x: startX,
            y: startY,
            targetX,
            targetY,
            progress: 0,
            speed: Math.random() * 0.015 + 0.015, // elegant, cinematic flight
            size: Math.random() * 3 + 2,
            trail: [],
            controlX: (startX + targetX) / 2 + (Math.random() - 0.5) * 150, // elegant bezier arc curve
            controlY: Math.min(startY, targetY) - 100 - Math.random() * 80,
            onComplete: null // callback upon hitting target
        });
    }

    /**
     * Simulates active shooting particles
     */
    updateShooting() {
        for (let i = this.shootingParticles.length - 1; i >= 0; i--) {
            const p = this.shootingParticles[i];
            p.progress += p.speed;

            // Save past positions for an elegant light ribbon trail
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 12) p.trail.shift();

            // Bezier curve interpolation (Quadratic Bezier)
            const t = p.progress;
            if (t >= 1.0) {
                // Call complete callback
                if (p.onComplete) p.onComplete(p.targetX, p.targetY);
                this.shootingParticles.splice(i, 1);
                continue;
            }

            // B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
            const mt = 1 - t;
            p.x = mt * mt * p.startX + 2 * mt * t * p.controlX + t * t * p.targetX;
            p.y = mt * mt * p.startY + 2 * mt * t * p.controlY + t * t * p.targetY;
        }
    }
}
