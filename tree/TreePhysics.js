/**
 * TreePhysics.js (Upgraded Cinematic Version)
 * Implements highly optimized wind sway dynamics, multi-layered parallax fireflies,
 * and high-performance particle pooling for 60fps mobile execution.
 */

export class TreePhysics {
    constructor() {
        this.time = 0;
        this.windStrength = 0.045; // Peaceful, tranquil sway
        this.windFrequency = 0.0013;

        // Active particles collections
        this.ambientParticles = [];
        this.shootingParticles = [];
        this.fallingLeaves = []; // Sparse falling leaf particles

        // Capacity and pooling systems (prevents GC frame drops)
        this.maxAmbient = 45;
        this.maxFallingLeaves = 4; // Serene, very occasional leaf drifting
        this.particlePool = []; // Recycled particle storage
    }

    /**
     * Obtains a recycled particle or creates a new one
     */
    getParticleFromPool() {
        if (this.particlePool.length > 0) {
            return this.particlePool.pop();
        }
        return {}; // Fresh object if pool empty
    }

    /**
     * Returns a dead particle to the pool for recycling
     */
    releaseToPool(particle) {
        // Clear references
        particle.onComplete = null;
        particle.trail = null;
        this.particlePool.push(particle);
    }

    /**
     * Primary tick physics update
     */
    tick(width, height) {
        this.time += 16.67; // approx ms per frame at 60fps

        // Slow cinematic wind wandering wave
        this.currentWind = Math.sin(this.time * this.windFrequency) * 
                           Math.cos(this.time * this.windFrequency * 0.73) * 
                           this.windStrength;

        // Update ambient firefly particles with 3D parallax depth
        this.updateAmbient(width, height);

        // Update active shooting particles
        this.updateShooting();

        // Update active falling leaves with slow feather sway physics
        this.updateFallingLeaves(width, height);
    }

    /**
     * Dynamic branch wind sway calculations based on height
     * @param {number} heightFraction - [0 at base, 1 at top]
     * @param {number} windSensitivity - factor from TreeState
     */
    getWindSway(heightFraction, windSensitivity, seed = 997) {
        // Exponential sway multiplier for absolute stability at base and graceful flexibility at top
        const heightMultiplier = Math.pow(heightFraction, 2.2);
        
        // Very gentle global wind sway
        const globalSway = this.currentWind * windSensitivity * 1.5;
        
        // Independent micro-sway phase shift per branch derived from seed
        const branchPhase = (seed % 1000) * 0.123;
        const branchSway = Math.sin(this.time * 0.0012 + branchPhase) * 0.018;
        
        return (globalSway + branchSway) * heightMultiplier;
    }

    /**
     * Ambient floating particles with 3D depth and parallax movement
     */
    updateAmbient(width, height) {
        // Spawn ambient fireflies if under capacity
        if (this.ambientParticles.length < this.maxAmbient && Math.random() < 0.04) {
            const p = this.getParticleFromPool();
            
            // 3D Depth Layer selection:
            // Layer 0 (Far Background): Tiny, slow, highly translucent
            // Layer 1 (Mid): Standard
            // Layer 2 (Foreground): Larger, faster, bright gold
            const depthLayer = Math.random() < 0.3 ? 0 : (Math.random() < 0.85 ? 1 : 2);
            
            p.depth = depthLayer;
            p.x = Math.random() * width;
            p.y = height * 0.25 + Math.random() * height * 0.65;
            
            // Speed scales directly with 3D depth
            const baseSpeed = depthLayer === 0 ? 0.08 : (depthLayer === 1 ? 0.22 : 0.45);
            p.vx = (Math.random() - 0.5) * baseSpeed * 0.8;
            p.vy = -(Math.random() * baseSpeed + baseSpeed * 0.5); // floats upward
            
            // Size and alpha scale with 3D depth
            p.size = depthLayer === 0 ? (Math.random() * 1.2 + 0.6) :
                     (depthLayer === 1 ? (Math.random() * 2.0 + 1.2) :
                                         (Math.random() * 3.5 + 2.5));
                                         
            p.alpha = depthLayer === 0 ? (Math.random() * 0.35 + 0.1) :
                      (depthLayer === 1 ? (Math.random() * 0.65 + 0.2) :
                                          (Math.random() * 0.85 + 0.4));

            p.color = Math.random() > 0.4 ? 'rgba(200, 166, 115, ' : 'rgba(46, 204, 113, '; // Gold or Emerald
            p.birth = this.time;
            p.life = Math.random() * 10000 + 8000; // Lives 8 to 18 seconds
            p.phase = Math.random() * Math.PI * 2;
            
            this.ambientParticles.push(p);
        }

        // Simulating the ambient particles
        for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
            const p = this.ambientParticles[i];
            const age = this.time - p.birth;

            if (age >= p.life) {
                this.ambientParticles.splice(i, 1);
                this.releaseToPool(p);
                continue;
            }

            // Sway horizontal drift
            const swayAmplitude = p.depth === 0 ? 0.08 : (p.depth === 1 ? 0.18 : 0.35);
            p.x += p.vx + Math.sin(this.time * 0.0008 + p.phase) * swayAmplitude;
            p.y += p.vy;

            // Soft cinematic fade-in at birth, fade-out at death
            const lifeFraction = age / p.life;
            let currentAlphaMultiplier = 1.0;
            if (lifeFraction < 0.15) {
                currentAlphaMultiplier = lifeFraction / 0.15;
            } else if (lifeFraction > 0.8) {
                currentAlphaMultiplier = (1.0 - lifeFraction) / 0.2;
            }
            p.currentAlpha = p.alpha * currentAlphaMultiplier;
        }
    }

    /**
     * Shoots a majestic golden particle in a gorgeous, slow Bezier arc
     */
    spawnShootingParticle(startX, startY, targetX, targetY) {
        const p = this.getParticleFromPool();
        
        p.startX = startX;
        p.startY = startY;
        p.x = startX;
        p.y = startY;
        p.targetX = targetX;
        p.targetY = targetY;
        
        p.progress = 0;
        // Slow cinematic velocity
        p.speed = Math.random() * 0.009 + 0.009; // takes ~1.5 - 2 seconds to land
        p.size = Math.random() * 3.5 + 2.5;
        p.trail = []; // dynamic trailing array
        
        // Curved Bezier control point to form a majestic arching vault
        p.controlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 200;
        p.controlY = Math.min(startY, targetY) - 160 - Math.random() * 120; // high dramatic arc
        p.onComplete = null;

        this.shootingParticles.push(p);
    }

    /**
     * Simulation of active shooting particles
     */
    updateShooting() {
        for (let i = this.shootingParticles.length - 1; i >= 0; i--) {
            const p = this.shootingParticles[i];
            p.progress += p.speed;

            // Save past positions for light-ribbon trails
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 15) p.trail.shift();

            if (p.progress >= 1.0) {
                if (p.onComplete) p.onComplete(p.targetX, p.targetY);
                this.shootingParticles.splice(i, 1);
                this.releaseToPool(p);
                continue;
            }

            // Quadratic Bezier Interpolation Curve
            const t = p.progress;
            const mt = 1 - t;
            p.x = mt * mt * p.startX + 2 * mt * t * p.controlX + t * t * p.targetX;
            p.y = mt * mt * p.startY + 2 * mt * t * p.controlY + t * t * p.targetY;
        }
    }

    /**
     * Spawns a slow, gracefully drifting falling leaf
     */
    spawnFallingLeaf(startX, startY, seed) {
        if (this.fallingLeaves.length >= this.maxFallingLeaves) return;

        const leaf = this.getParticleFromPool();
        leaf.type = 'falling_leaf';
        leaf.x = startX;
        leaf.y = startY;
        leaf.seed = seed;
        leaf.birth = this.time;
        // Longer lifetime for slower, extremely serene drifting
        leaf.life = 10000 + Math.random() * 6000; // 10 to 16 seconds
        leaf.phase = Math.random() * Math.PI * 2;
        
        // Slower vertical descent rate for calm night-breeze feel
        leaf.vy = 0.25 + Math.random() * 0.15;
        
        // Horizontal zig-zag glide settings
        leaf.swayFreq = 0.0012 + Math.random() * 0.0008;
        leaf.swayAmp = 0.4 + Math.random() * 0.3;
        
        leaf.size = 6 + (seed % 4);
        leaf.rotation = Math.random() * Math.PI * 2;
        leaf.rotationSpeed = (Math.random() - 0.5) * 0.012;
        leaf.currentAlpha = 1.0;

        this.fallingLeaves.push(leaf);
    }

    /**
     * Simulated aerodynamics of active falling leaves
     */
    updateFallingLeaves(width, height) {
        for (let i = this.fallingLeaves.length - 1; i >= 0; i--) {
            const leaf = this.fallingLeaves[i];
            const age = this.time - leaf.birth;

            // Fade out and recycle leaf when its lifespan ends or it drifts offscreen
            if (age >= leaf.life || leaf.y > height + 20) {
                this.fallingLeaves.splice(i, 1);
                this.releaseToPool(leaf);
                continue;
            }

            // Beautiful feather-like gliding: slow vertical fall + horizontal zig-zag waving
            leaf.x += Math.sin(age * leaf.swayFreq + leaf.phase) * leaf.swayAmp;
            leaf.y += leaf.vy;

            // Extremely gentle spinning
            leaf.rotation += leaf.rotationSpeed;

            // Calm cinematic fade-out towards death
            const lifeFraction = age / leaf.life;
            leaf.currentAlpha = Math.max(0, 1.0 - lifeFraction);
        }
    }
}
