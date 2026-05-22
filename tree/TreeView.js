/**
 * TreeView.js (Upgraded Cinematic Version)
 * Main entry orchestrator. Manages canvas drawing frame loops, Retina DPI resolutions,
 * horizontal mist layer triggers, vignette layers, and caching of branch growth coordinates.
 */

import { TreeState } from './TreeState.js';
import { TreePhysics } from './TreePhysics.js';
import { LeafSystem } from './LeafSystem.js';
import { GlowEffects } from './GlowEffects.js';
import { TreeAnimations } from './TreeAnimations.js';
import { RealtimeEngine } from './RealtimeEngine.js';

export class TreeView {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`[TreeView] Canvas with ID "${canvasId}" not found.`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        
        // Initialize sub-modules
        this.state = new TreeState();
        this.physics = new TreePhysics();
        this.leafSystem = new LeafSystem();
        this.glowEffects = new GlowEffects();
        this.animations = new TreeAnimations();
        this.realtime = new RealtimeEngine(this.state, this.physics, this.canvas);

        // Active branch tips / foliage coordinate list
        this.activeLeafNodes = [];

        // Kinetic effects array for starbursts on impact
        this.impactGlows = [];

        // Publish internal instance globally for RealtimeEngine to query branch coordinates
        window.GlobalTreeOfGoodnessInstance = this;

        // Configure sizing and sharp Retina display DPI
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Listen for star burst event triggered on particle landing
        window.addEventListener('tree-star-burst', (e) => {
            if (e.detail) {
                this.spawnImpactGlow(e.detail.x, e.detail.y);
            }
        });

        // Start animation loop
        this.startLoop();

        // Start background statistics sync polling
        this.realtime.start();
        
        // Publish external Global API to window
        this.publishAPI();
    }

    /**
     * Retina sharp DPI scaling configuration
     */
    resize() {
        const rect = this.canvas.parentNode.getBoundingClientRect();
        
        const cssWidth = rect.width || 450;
        const cssHeight = cssWidth > 600 ? 460 : 360;

        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = cssWidth * dpr;
        this.canvas.height = cssHeight * dpr;

        // Scale context
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);

        this.logicalWidth = cssWidth;
        this.logicalHeight = cssHeight;
    }

    /**
     * Creates a bright golden flash when a shooting star reaches the canopy
     */
    spawnImpactGlow(x, y) {
        this.impactGlows.push({
            x,
            y,
            radius: 2,
            maxRadius: 50, // slightly larger flash
            alpha: 1.0,
            speed: 1.8 // fast, energetic flash
        });
    }

    /**
     * Main requestAnimationFrame update loop
     */
    startLoop() {
        const loop = () => {
            this.tick();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /**
     * Single frame update & render tick
     */
    tick() {
        // 1. UPDATE physics, sways, and interpolations
        this.state.tick();
        this.physics.tick(this.logicalWidth, this.logicalHeight);

        // 2. RENDER steps
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        // A. Draw twilight sky, radial золотой halo, and horizontal mist layers
        this.glowEffects.drawBackgroundAtmosphere(this.ctx, this.logicalWidth, this.logicalHeight);

        // B. Procedurally draw organic wood trunk & branching boughs
        const treeBaseX = this.logicalWidth / 2;
        const treeBaseY = this.logicalHeight - 12; // offset from bottom edge

        // Temporary array to hold coordinates calculated during this frame's tree drawing
        const frameLeafNodes = [];
        
        ctxSaveAndRun(this.ctx, () => {
            // Draw tree branches procedurally and cache active foliage coordinates
            this.animations.branch(
                this.ctx,
                treeBaseX,
                treeBaseY,
                110 * this.state.visualStats.treeScale,
                -Math.PI / 2, // Upward
                18 * this.state.visualStats.treeScale,
                0,
                this.state.visualStats.recursionDepth,
                this.state.visualStats.windSwaySensitivity,
                this.physics,
                this.state.visualStats.branchLengthFactor,
                frameLeafNodes
            );
        });

        // Store these coordinates on the instance so the RealtimeEngine can reference them
        this.activeLeafNodes = frameLeafNodes;

        // C. Draw Foliage on top of cached branch coordinate nodes
        const breathingFactor = Date.now() * 0.0009;
        
        // C1. Draw Green Leaves (Dhikr)
        const leafCount = Math.min(frameLeafNodes.length, Math.round(this.state.visualStats.leaves));
        for (let i = 0; i < leafCount; i++) {
            const node = frameLeafNodes[i % frameLeafNodes.length];
            const size = 9 + (i % 5);
            this.leafSystem.drawLeaf(this.ctx, node.x, node.y, node.angle, size, i, breathingFactor);
        }

        // C2. Draw blossoms (Milestones)
        const flowerCount = Math.min(frameLeafNodes.length, Math.round(this.state.visualStats.flowers));
        for (let i = 0; i < flowerCount; i++) {
            const node = frameLeafNodes[(i * 9 + 4) % frameLeafNodes.length];
            const size = 8 + (i % 4);
            const rotation = (i * 1.5) % (Math.PI * 2);
            this.leafSystem.drawFlower(this.ctx, node.x, node.y, size, rotation, breathingFactor, i);
        }

        // C3. Draw golden diamond stars (Shares)
        const starCount = Math.min(frameLeafNodes.length, Math.round(this.state.visualStats.stars));
        const timeFactor = Date.now() * 0.0022;
        for (let i = 0; i < starCount; i++) {
            const node = frameLeafNodes[(i * 17 + 7) % frameLeafNodes.length];
            const size = 6 + (i % 5);
            const pulse = 1.0 + Math.sin(timeFactor + i) * 0.16;
            
            const offsetDist = 5 + (i % 6);
            const ox = Math.cos(node.angle) * offsetDist;
            const oy = Math.sin(node.angle) * offsetDist;
            
            this.leafSystem.drawStar(this.ctx, node.x + ox, node.y + oy, size, pulse, i);
        }

        // D. Render ambient fireflies & floating light dust (glow blending)
        this.glowEffects.enableGlowMode(this.ctx);
        this.physics.ambientParticles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.currentAlpha;
            this.ctx.fillStyle = p.color + p.currentAlpha + ')'; // Apply alpha
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // E. Draw active shooting stars
        this.physics.shootingParticles.forEach(p => {
            this.ctx.save();
            
            if (p.trail.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let i = 1; i < p.trail.length; i++) {
                    this.ctx.lineTo(p.trail[i].x, p.trail[i].y);
                }
                const trailGrad = this.ctx.createLinearGradient(
                    p.trail[0].x, p.trail[0].y, 
                    p.x, p.y
                );
                trailGrad.addColorStop(0, 'rgba(200, 166, 115, 0)');
                trailGrad.addColorStop(1, 'rgba(240, 223, 193, 0.75)');
                this.ctx.strokeStyle = trailGrad;
                this.ctx.lineWidth = p.size * 0.75;
                this.ctx.lineCap = 'round';
                this.ctx.stroke();
            }

            // Star tip glow
            const starGlow = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
            starGlow.addColorStop(0, '#ffffff');
            starGlow.addColorStop(0.5, '#fbf2d8');
            starGlow.addColorStop(1, 'rgba(200, 166, 115, 0)');
            this.ctx.fillStyle = starGlow;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });

        // F. Render impact starburst rings
        for (let i = this.impactGlows.length - 1; i >= 0; i--) {
            const glow = this.impactGlows[i];
            glow.radius += glow.speed;
            glow.alpha = 1.0 - (glow.radius / glow.maxRadius);

            if (glow.alpha <= 0) {
                this.impactGlows.splice(i, 1);
                continue;
            }

            this.glowEffects.drawPointGlow(
                this.ctx, 
                glow.x, 
                glow.y, 
                glow.radius, 
                `rgba(251, 242, 216, ${glow.alpha * 0.8})`
            );
        }
        
        // G. Draw rich dark vignette boundaries
        this.glowEffects.drawVignetteOverlay(this.ctx, this.logicalWidth, this.logicalHeight);

        this.glowEffects.disableGlowMode(this.ctx);
    }

    /**
     * Publishes public global interface so legacy community.js can communicate seamlessly
     */
    publishAPI() {
        window.GlobalTreeOfGoodness = {
            /**
             * Direct update method for stats changes
             */
            updateStats: (approvedCount, sharesCount) => {
                this.state.update(approvedCount, sharesCount);
            },

            /**
             * Triggers a shooting star golden animation from a click event
             */
            triggerShareEffect: (clickEvent) => {
                this.realtime.triggerShareVisualEffect(clickEvent);
            },

            /**
             * Recalculates display sizes
             */
            resize: () => {
                this.resize();
            }
        };

        console.debug('[TreeOfGoodness] Upgraded Cinematic Engine published! 🌳✨');
    }
}

/**
 * Clean helper function to safely isolate drawing operations
 */
function ctxSaveAndRun(ctx, callback) {
    ctx.save();
    callback();
    ctx.restore();
}

// Auto-instantiate on load if tree canvas is present
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('treeCanvas')) {
        new TreeView('treeCanvas');
    }
});
