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

        // A. Draw twilight sky, radial golden halo, and horizontal mist layers
        this.glowEffects.drawBackgroundAtmosphere(this.ctx, this.logicalWidth, this.logicalHeight, this.state);

        // B. Procedurally draw organic wood trunk & branching boughs
        const treeBaseX = this.logicalWidth / 2;
        const treeBaseY = this.logicalHeight - 12; // offset from bottom edge

        // Temporary arrays to hold coordinates calculated during this frame's tree drawing
        const frameLeafNodes = [];
        const frameBranchSegments = [];
        
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
                frameLeafNodes,
                frameBranchSegments
            );
        });

        // Store these coordinates on the instance so the RealtimeEngine can reference them
        this.activeLeafNodes = frameLeafNodes;

        // Categorize leaves into Front, Mid, and Back layers while applying deterministic breathing gaps
        const backNodes = [];
        const midNodes = [];
        const frontNodes = [];

        frameLeafNodes.forEach(node => {
            const seed = node.seed;
            
            if (node.isInner) {
                // Breathing gaps: skip 40% of inner canopy coordinates for airy pocket design
                if (seed % 10 < 4) return;

                // Depth classification
                const depthSeed = seed % 10;
                if (depthSeed < 4) {
                    backNodes.push(node);  // 40% background
                } else if (depthSeed < 8) {
                    midNodes.push(node);   // 40% midground
                } else {
                    frontNodes.push(node);  // 20% foreground
                }
            } else {
                // Breathing gaps: skip 15% of outer canopy tips for lighter natural branch tips
                if (seed % 20 < 3) return;

                // Depth classification
                const depthSeed = seed % 10;
                if (depthSeed < 3) {
                    backNodes.push(node);  // 30% background
                } else if (depthSeed < 7) {
                    midNodes.push(node);   // 40% midground
                } else {
                    frontNodes.push(node);  // 30% foreground
                }
            }
        });

        // Separate outer branch tips from inner canopy fill coordinates
        const outerNodes = frameLeafNodes.filter(node => !node.isInner);

        // Spawn a falling leaf occasionally (approx every 12-15 seconds)
        if (outerNodes.length > 0 && Math.random() < 0.0012) {
            const randomNode = outerNodes[Math.floor(Math.random() * outerNodes.length)];
            this.physics.spawnFallingLeaf(randomNode.x, randomNode.y, randomNode.seed);
        }

        // C. Draw Foliage in isolated depth layers interleaved with branch structures
        const breathingFactor = Date.now() * 0.0009;
        const totalTargetLeaves = this.state.visualStats.leaves;
        
        // Target leaf count for each layer based on organic cinematic ratios
        const backTarget = Math.round(totalTargetLeaves * 0.35);
        const midTarget = Math.round(totalTargetLeaves * 0.45);
        const frontTarget = Math.round(totalTargetLeaves * 0.20);
        
        // C0. DRAW BACK LAYER LEAVES (Background volume - dark, desaturated, translucent, single leaves drawn behind branches)
        const backCount = Math.min(backNodes.length, backTarget);
        const backStep = backCount > 0 ? backNodes.length / backCount : 1;
        for (let i = 0; i < backCount; i++) {
            const nodeIndex = Math.floor(i * backStep);
            const node = backNodes[nodeIndex % backNodes.length];
            const size = 12 + (node.seed % 4);
            this.leafSystem.drawLeaf(this.ctx, node.x, node.y, node.angle, size, node.seed, breathingFactor, 'back', 1.0);
        }

        // C1. DRAW BARK BRANCH SKELETON (Drawn over Back leaves so they sit behind the branches!)
        ctxSaveAndRun(this.ctx, () => {
            // Draw beautiful organic roots fading into soil at base
            this.animations.drawRoots(this.ctx, treeBaseX, treeBaseY, 18 * this.state.visualStats.treeScale, this.state.visualStats.treeScale);

            // Draw procedural branch segments
            frameBranchSegments.forEach(segment => {
                this.animations.drawBranchSegment(this.ctx, segment);
            });
        });

        // C2. DRAW MID LAYER LEAVES (Midground - balanced sage/emerald, organic clusters of 1 or 2 leaves)
        // Average cluster rate of 50% yields 1.5 leaves per node, so we scale midCount by dividing by 1.5
        const midCount = Math.min(midNodes.length, Math.max(1, Math.round(midTarget / 1.5)));
        const midStep = midCount > 0 ? midNodes.length / midCount : 1;
        for (let i = 0; i < midCount; i++) {
            const nodeIndex = Math.floor(i * midStep);
            const node = midNodes[nodeIndex % midNodes.length];
            const size = 17 + (node.seed % 5);
            
            // Draw central leaf
            this.leafSystem.drawLeaf(this.ctx, node.x, node.y, node.angle, size, node.seed, breathingFactor, 'mid', 1.0);
            
            // Organic cluster offset (50% cluster rate)
            if (node.seed % 4 >= 2) {
                const scale = 0.76 + (node.seed % 3) * 0.04;
                const angleOffset = 0.44 + (node.seed % 4) * 0.03;
                const offsetDist = size * (0.30 + (node.seed % 3) * 0.03);
                
                if (node.seed % 2 === 0) { // Left offset
                    const lx = node.x + Math.cos(node.angle - 0.34) * offsetDist;
                    const ly = node.y + Math.sin(node.angle - 0.34) * offsetDist;
                    this.leafSystem.drawLeaf(this.ctx, lx, ly, node.angle - angleOffset, size * scale, node.seed + 999, breathingFactor, 'mid', 0.82);
                } else { // Right offset
                    const rx = node.x + Math.cos(node.angle + 0.34) * offsetDist;
                    const ry = node.y + Math.sin(node.angle + 0.34) * offsetDist;
                    this.leafSystem.drawLeaf(this.ctx, rx, ry, node.angle + angleOffset, size * scale, node.seed + 888, breathingFactor, 'mid', 0.82);
                }
            }
        }

        // C3. DRAW FRONT LAYER LEAVES (Foreground - vibrant emerald, organic clusters of 1, 2, or 3 leaves)
        // Average cluster rate yields 1.8 leaves per node, so we scale frontCount by dividing by 1.8
        const frontCount = Math.min(frontNodes.length, Math.max(1, Math.round(frontTarget / 1.8)));
        const frontStep = frontCount > 0 ? frontNodes.length / frontCount : 1;
        for (let i = 0; i < frontCount; i++) {
            const nodeIndex = Math.floor(i * frontStep);
            const node = frontNodes[nodeIndex % frontNodes.length];
            const size = 22 + (node.seed % 6);
            
            // Draw central leaf
            this.leafSystem.drawLeaf(this.ctx, node.x, node.y, node.angle, size, node.seed, breathingFactor, 'front', 1.0);
            
            // Organic cluster offset: 40% single leaf, 40% double (1 side), 20% triple (both sides)
            const clusterMode = node.seed % 10;
            const leftScale = 0.74 + (node.seed % 3) * 0.05;
            const rightScale = 0.74 + ((node.seed + 2) % 3) * 0.05;
            const leftAngleOffset = 0.42 + (node.seed % 4) * 0.04;
            const rightAngleOffset = 0.42 + ((node.seed + 2) % 4) * 0.04;
            
            const leftOffsetDist = size * (0.28 + (node.seed % 3) * 0.03);
            const rightOffsetDist = size * (0.28 + ((node.seed + 2) % 3) * 0.03);
            
            if (clusterMode >= 4 && clusterMode < 8) { // Draw left only (40%)
                const lx = node.x + Math.cos(node.angle - 0.34) * leftOffsetDist;
                const ly = node.y + Math.sin(node.angle - 0.34) * leftOffsetDist;
                this.leafSystem.drawLeaf(this.ctx, lx, ly, node.angle - leftAngleOffset, size * leftScale, node.seed + 999, breathingFactor, 'front', 0.82);
            } else if (clusterMode >= 8) { // Draw both left and right (20%)
                const lx = node.x + Math.cos(node.angle - 0.34) * leftOffsetDist;
                const ly = node.y + Math.sin(node.angle - 0.34) * leftOffsetDist;
                this.leafSystem.drawLeaf(this.ctx, lx, ly, node.angle - leftAngleOffset, size * leftScale, node.seed + 999, breathingFactor, 'front', 0.82);
                
                const rx = node.x + Math.cos(node.angle + 0.34) * rightOffsetDist;
                const ry = node.y + Math.sin(node.angle + 0.34) * rightOffsetDist;
                this.leafSystem.drawLeaf(this.ctx, rx, ry, node.angle + rightAngleOffset, size * rightScale, node.seed + 888, breathingFactor, 'front', 0.82);
            }
        }

        // C4. Draw blossoms (Milestones)
        const flowerCount = Math.min(outerNodes.length, Math.round(this.state.visualStats.flowers));
        for (let i = 0; i < flowerCount; i++) {
            const node = outerNodes[(i * 9 + 4) % outerNodes.length];
            const size = 8 + (node.seed % 4);
            const rotation = (node.seed * 1.5) % (Math.PI * 2);
            this.leafSystem.drawFlower(this.ctx, node.x, node.y, size, rotation, breathingFactor, node.seed);
        }

        // C5. Draw golden diamond stars (Shares - Rebalanced as quiet delicate accent twinkles)
        const starCount = Math.min(outerNodes.length, Math.round(this.state.visualStats.stars));
        const timeFactor = Date.now() * 0.0022;
        const usedStarIndices = new Set();
        let starsDrawn = 0;
        for (let i = 0; i < outerNodes.length && starsDrawn < starCount; i++) {
            const index = (i * 17 + 7) % outerNodes.length;
            if (usedStarIndices.has(index)) continue;
            usedStarIndices.add(index);
            
            const node = outerNodes[index];
            const size = 7 + (node.seed % 4); // Beautiful, visible but delicate size
            const pulse = 1.0 + Math.sin(timeFactor + node.seed) * 0.16;
            
            const offsetDist = 5 + (node.seed % 6);
            const ox = Math.cos(node.angle) * offsetDist;
            const oy = Math.sin(node.angle) * offsetDist;
            
            this.leafSystem.drawStar(this.ctx, node.x + ox, node.y + oy, size, pulse, node.seed);
            starsDrawn++;
        }

        // C4. Draw occasional falling leaves
        this.physics.fallingLeaves.forEach(leaf => {
            this.ctx.save();
            this.ctx.translate(leaf.x, leaf.y);
            this.ctx.rotate(leaf.rotation);
            
            // Draw a soft glowing leaf texture
            this.ctx.globalAlpha = leaf.currentAlpha * 0.65;
            
            // Draw leaf sprite (Sage or Emerald leaf texture)
            const sprite = (leaf.seed % 2 === 0) ? this.leafSystem.sprites.leafFront : this.leafSystem.sprites.leafMid;
            const finalScale = leaf.size / 22;
            this.ctx.scale(finalScale, finalScale);
            
            this.ctx.drawImage(
                this.leafSystem.spriteCanvas,
                sprite.x, sprite.y, sprite.w, sprite.h,
                -32, -32, 64, 64 // center drawn
            );
            
            this.ctx.restore();
        });

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
