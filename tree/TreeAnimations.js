/**
 * TreeAnimations.js (Upgraded Cinematic Version)
 * Implements procedural organic branching utilizing fluid Bezier splines,
 * volumetric 3-layer wood-bark rendering, root-fade soil blending,
 * and fractional-recursion smooth branch sprouting growth stages.
 */

export class TreeAnimations {
    constructor() {
        this.rngSeed = 101;
    }

    resetRNG() {
        this.rngSeed = 997; // Pure prime seed
    }

    nextRandom() {
        this.rngSeed = (this.rngSeed * 9301 + 49297) % 233280;
        return this.rngSeed / 233280;
    }

    /**
     * Primary entry point for rendering the cinematic tree
     */
    drawTree(ctx, startX, startY, physics, state, leafSystem) {
        this.resetRNG();
        
        const leafNodes = [];

        // Dynamic metrics from visualStats
        const scale = state.visualStats.treeScale;
        const targetDepth = state.visualStats.recursionDepth;
        const windSensitivity = state.visualStats.windSwaySensitivity;

        const initialLength = 110 * scale;
        // Make the trunk wider and more majestic!
        const initialThickness = 18 * scale; 

        // 1. DRAW ROOT FADE SOIL MERGING (الاندماج الأرضي)
        this.drawRoots(ctx, startX, startY, initialThickness, scale);

        ctx.save();
        
        // 2. RECURSIVELY DRAW VOLUMETRIC BARK SPLINES
        this.branch(
            ctx,
            startX,
            startY,
            initialLength,
            -Math.PI / 2, // Straight up
            initialThickness,
            0,            // current recursion depth
            targetDepth,  // fractional recursion limit
            windSensitivity,
            physics,
            state.visualStats.branchLengthFactor,
            leafNodes
        );

        // Deterministic leaf index mapping
        leafNodes.forEach((node, index) => {
            node.index = index;
        });

        // 3. DRAW LEAF BREATHING FOLIAGE
        const breathingFactor = Date.now() * 0.0009; // slow spiritual breathing frequency
        const leafCount = Math.min(leafNodes.length, Math.round(state.visualStats.leaves));
        for (let i = 0; i < leafCount; i++) {
            const node = leafNodes[i % leafNodes.length];
            const size = 9 + (i % 5);
            // Dynamic random rotation offsets
            const angleOffset = (this.nextRandom() - 0.5) * 1.6;
            
            leafSystem.drawLeaf(
                ctx, 
                node.x, 
                node.y, 
                node.angle + angleOffset, 
                size, 
                i, 
                breathingFactor
            );
        }

        // 4. DRAW JASMIN BLOSSOMS
        const flowerCount = Math.min(leafNodes.length, Math.round(state.visualStats.flowers));
        for (let i = 0; i < flowerCount; i++) {
            const node = leafNodes[(i * 9 + 4) % leafNodes.length]; // spread out
            const size = 8 + (i % 4);
            const rotation = this.nextRandom() * Math.PI * 2;
            
            leafSystem.drawFlower(ctx, node.x, node.y, size, rotation, breathingFactor, i);
        }

        // 5. DRAW TWINKLING GOLD STAR GEMS (✦)
        const starCount = Math.min(leafNodes.length, Math.round(state.visualStats.stars));
        const timeFactor = Date.now() * 0.0022;
        for (let i = 0; i < starCount; i++) {
            const node = leafNodes[(i * 17 + 7) % leafNodes.length];
            const size = 6 + (i % 5);
            const pulse = 1.0 + Math.sin(timeFactor + i) * 0.16; // calm twinkling
            
            // offset slightly from branch tips for sparkling sky dust effect
            const offsetDist = 5 + (i % 6);
            const ox = Math.cos(node.angle) * offsetDist;
            const oy = Math.sin(node.angle) * offsetDist;
            
            leafSystem.drawStar(ctx, node.x + ox, node.y + oy, size, pulse, i);
        }

        ctx.restore();
    }

    /**
     * Draws beautiful, organic roots fading into the soil at the base
     */
    drawRoots(ctx, x, y, trunkThickness, scale) {
        ctx.save();
        this.resetRNG();

        const numRoots = 4;
        const rootLength = 32 * scale;
        
        for (let i = 0; i < numRoots; i++) {
            const angle = Math.PI - 0.45 + (i * 0.3) + (this.nextRandom() - 0.5) * 0.1;
            const endX = x + Math.cos(angle) * rootLength;
            const endY = y + Math.sin(angle) * rootLength * 0.4; // shallow root depth

            ctx.beginPath();
            ctx.moveTo(x + (i - 1.5) * (trunkThickness * 0.22), y);
            ctx.quadraticCurveTo(x + (i - 1.5) * (trunkThickness * 0.22), y + 10 * scale, endX, endY);

            // Soil-merging gradient (fades to 0 opacity)
            const rootGrad = ctx.createLinearGradient(x, y, endX, endY);
            rootGrad.addColorStop(0, '#2e1e0f'); // trunk brown
            rootGrad.addColorStop(1, 'rgba(11, 20, 36, 0)'); // deep indigo bg color

            ctx.strokeStyle = rootGrad;
            ctx.lineWidth = trunkThickness * (0.5 - i * 0.05);
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Recursive branching algorithm supporting fractional recursion depth limits (smooth bough sprouting)
     */
    branch(ctx, x, y, length, angle, thickness, depth, targetDepth, windSensitivity, physics, lengthFactor, leafNodes, seed = 997) {
        // Enforce fractional recursion boundary
        const intTargetDepth = Math.floor(targetDepth);
        const fraction = targetDepth - intTargetDepth;

        let drawScale = 1.0;

        // Initialize a deterministic branch local generator based on this branch's unique seed
        let localSeed = seed;
        const nextLocalRand = () => {
            localSeed = (localSeed * 9301 + 49297) % 233280;
            return localSeed / 233280;
        };

        if (depth > intTargetDepth) {
            // If this is the next level during fractional growth, scale the branch down smoothly
            if (depth === intTargetDepth + 1 && fraction > 0.05) {
                drawScale = fraction;
            } else {
                // Growth node coordinate
                leafNodes.push({ x, y, angle, seed: localSeed });
                return;
            }
        }

        // Apply wind physics to branch angle
        const heightFraction = depth / 7;
        const windSway = physics.getWindSway(heightFraction, windSensitivity, seed);
        const adjustedAngle = angle + windSway;

        // Apply fractional length/thickness scaling
        const branchLength = length * drawScale;
        const branchThickness = thickness * drawScale;

        // Calculate organic curved control points
        const endX = x + Math.cos(adjustedAngle) * branchLength;
        const endY = y + Math.sin(adjustedAngle) * branchLength;

        // Curved spline control points
        const curveOffset = (nextLocalRand() - 0.5) * (14 / (depth + 1));
        const ctrlX = x + Math.cos(adjustedAngle) * (branchLength * 0.5) + Math.cos(adjustedAngle + Math.PI / 2) * curveOffset;
        const ctrlY = y + Math.sin(adjustedAngle) * (branchLength * 0.5) + Math.sin(adjustedAngle + Math.PI / 2) * curveOffset;

        // RENDER STEP: 3-LAYER VOLUMETRIC BARK (التجسيم الخشبي الفاخر)
        ctx.save();
        ctx.lineCap = 'round';

        // --- LAYER 1: Main Dark Bark Base ---
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);

        const barkGrad = ctx.createLinearGradient(x, y, endX, endY);
        barkGrad.addColorStop(0, '#2e1e0f'); // Deep cosmic wood base
        barkGrad.addColorStop(0.5, '#3e2c1a'); // Shaded bark
        barkGrad.addColorStop(1, '#4f3b26'); // Soft branch tip

        ctx.strokeStyle = barkGrad;
        ctx.lineWidth = branchThickness;
        ctx.stroke();

        // --- LAYER 2: Volumetric Contour Shadow (Interior Bark Textures) ---
        if (branchThickness > 1.8) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
            
            ctx.strokeStyle = 'rgba(12, 6, 2, 0.35)'; // Organic shaded core
            ctx.lineWidth = branchThickness * 0.65;
            ctx.stroke();
        }

        // --- LAYER 3: Golden Celestial Specular Edge Highlight ---
        if (branchThickness > 1.2) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
            
            // Simulates background celestial light hitting the branch edge
            const highlightGrad = ctx.createLinearGradient(x, y, endX, endY);
            highlightGrad.addColorStop(0, 'rgba(200, 166, 115, 0.28)'); // Warm soft gold aura
            highlightGrad.addColorStop(1, 'rgba(251, 242, 216, 0.05)');

            ctx.strokeStyle = highlightGrad;
            ctx.lineWidth = branchThickness * 0.25;
            ctx.stroke();
        }

        ctx.restore();

        // Push internal foliage cluster nodes for canopy center fill
        if (depth >= 3) {
            leafNodes.push({
                x: ctrlX,
                y: ctrlY,
                angle: adjustedAngle + 0.35,
                seed: (localSeed + 1234) | 0,
                isInner: true
            });
            leafNodes.push({
                x: ctrlX,
                y: ctrlY,
                angle: adjustedAngle - 0.35,
                seed: (localSeed + 5678) | 0,
                isInner: true
            });
        }

        // Halt recursion if this was the final fractional sprouting layer
        if (drawScale < 1.0) {
            leafNodes.push({ x: endX, y: endY, angle: adjustedAngle, seed: localSeed });
            return;
        }

        // Determine recursion splits (base primary boughs versus upper branchlets)
        const numSplits = (depth === 0) ? 3 : 2;
        
        for (let i = 0; i < numSplits; i++) {
            let nextAngle;
            const childSeed = (seed * 31 + i + 1) | 0;

            let splitSeed = childSeed;
            const nextSplitRand = () => {
                splitSeed = (splitSeed * 9301 + 49297) % 233280;
                return splitSeed / 233280;
            };

            if (numSplits === 3) {
                // Majestic 3-way primary bough layout
                const boughAngles = [-0.44, 0.02, 0.46];
                nextAngle = adjustedAngle + boughAngles[i] + (nextSplitRand() - 0.5) * 0.14;
            } else {
                // Elegant fluid 2-way asymmetrical branching
                const angleOffsets = [-0.36, 0.38];
                const asymmetricSkew = (nextSplitRand() - 0.5) * 0.1; // organic asymmetry
                nextAngle = adjustedAngle + angleOffsets[i] + asymmetricSkew;
            }

            // Interpolated length reduction factor from TreeState
            const lengthReduction = lengthFactor + (nextSplitRand() * 0.07);
            
            this.branch(
                ctx,
                endX,
                endY,
                branchLength * lengthReduction,
                nextAngle,
                branchThickness * 0.64,
                depth + 1,
                targetDepth,
                windSensitivity,
                physics,
                lengthFactor,
                leafNodes,
                childSeed
            );
        }
    }
}
