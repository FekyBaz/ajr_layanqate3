/**
 * TreeAnimations.js
 * Implements organic procedural recursive tree branching (L-system style)
 * with dynamic wind physics sway and smooth branch thickness scaling.
 */

export class TreeAnimations {
    constructor() {
        // Pseudo-random generator seed to keep the organic tree stable
        this.rngSeed = 101;
    }

    /**
     * Re-seed the pseudo-random generator
     */
    resetRNG() {
        this.rngSeed = 997; // a beautiful prime
    }

    /**
     * Deterministic pseudo-random float [0, 1)
     */
    nextRandom() {
        // Simple and fast LCG (Linear Congruential Generator)
        this.rngSeed = (this.rngSeed * 9301 + 49297) % 233280;
        return this.rngSeed / 233280;
    }

    /**
     * Draws the organic tree procedurally
     * @param {CanvasRenderingContext2D} ctx - canvas 2D context
     * @param {number} startX - base X
     * @param {number} startY - base Y
     * @param {TreePhysics} physics - physics engine for wind sway
     * @param {TreeState} state - tree state for leaf/star density
     * @param {LeafSystem} leafSystem - foliage rendering system
     */
    drawTree(ctx, startX, startY, physics, state, leafSystem) {
        this.resetRNG();
        
        // Cache leaf nodes where we can plant foliage/stars
        const leafNodes = [];

        // Dynamic scale factor of the tree height based on total contributions
        const scale = state.visualStats.treeScale;
        const initialLength = 115 * scale;
        const initialThickness = 14 * scale;

        ctx.save();
        
        // Let's recursively draw the branches
        this.branch(
            ctx,
            startX,
            startY,
            initialLength,
            -Math.PI / 2, // going straight up
            initialThickness,
            0,            // depth / recursion level
            physics,
            leafNodes
        );

        // Sort leaf nodes deterministically so that leaves grow in the same spots
        leafNodes.forEach((node, index) => {
            node.index = index;
        });

        // 1. Draw Green Leaves (Dhikr)
        const leafCount = Math.min(leafNodes.length, Math.round(state.visualStats.leaves));
        for (let i = 0; i < leafCount; i++) {
            const node = leafNodes[i % leafNodes.length];
            // Leaf size scales slightly with approved count
            const size = 9 + (i % 4);
            const angleOffset = (this.nextRandom() - 0.5) * 1.5;
            leafSystem.drawLeaf(ctx, node.x, node.y, node.angle + angleOffset, size, i);
        }

        // 2. Draw Blossoms/Flowers (Featured milestones)
        const flowerCount = Math.min(leafNodes.length, Math.round(state.visualStats.flowers));
        for (let i = 0; i < flowerCount; i++) {
            const node = leafNodes[(i * 7 + 3) % leafNodes.length]; // spread them out
            const size = 7 + (i % 3);
            const rotation = this.nextRandom() * Math.PI * 2;
            leafSystem.drawFlower(ctx, node.x, node.y, size, rotation);
        }

        // 3. Draw Twinkling Golden Stars (Shares)
        const starCount = Math.min(leafNodes.length, Math.round(state.visualStats.stars));
        const timeFactor = Date.now() * 0.003;
        for (let i = 0; i < starCount; i++) {
            const node = leafNodes[(i * 13 + 5) % leafNodes.length];
            const size = 6 + (i % 4);
            const pulse = 1.0 + Math.sin(timeFactor + i) * 0.15; // gentle twinkle animation
            leafSystem.drawStar(ctx, node.x + (i % 3 - 1) * 8, node.y + (i % 3 - 1) * 8, size, pulse, i);
        }

        ctx.restore();
    }

    /**
     * Recursive branching function
     */
    branch(ctx, x, y, length, angle, thickness, depth, physics, leafNodes) {
        if (depth > 6 || thickness < 0.8) {
            // Leaf/foliage attachment coordinate
            leafNodes.push({ x, y, angle });
            return;
        }

        // Wind sway factor - upper branches sway much more
        const heightFraction = depth / 7;
        const windSway = physics.getWindSway(heightFraction);
        const adjustedAngle = angle + windSway;

        // End coordinates of the current branch
        const endX = x + Math.cos(adjustedAngle) * length;
        const endY = y + Math.sin(adjustedAngle) * length;

        // Draw organic wood branch
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, y);
        // Slightly organic curved branches instead of perfectly straight lines
        const ctrlX = x + Math.cos(adjustedAngle) * (length * 0.5) + (this.nextRandom() - 0.5) * (10 / (depth + 1));
        const ctrlY = y + Math.sin(adjustedAngle) * (length * 0.5) + (this.nextRandom() - 0.5) * (10 / (depth + 1));
        ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);

        // Warm, natural woody gradient
        const branchGrad = ctx.createLinearGradient(x, y, endX, endY);
        branchGrad.addColorStop(0, '#3e2c1a'); // Dark trunk brown
        branchGrad.addColorStop(0.5, '#4f3b26'); // Mid bark
        branchGrad.addColorStop(1, '#654f39'); // Soft organic branch tip

        ctx.strokeStyle = branchGrad;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Branching logic: 2 or 3 branches at each node
        const numBranches = (depth === 0) ? 3 : 2; // base splits into 3 primary boughs
        
        for (let i = 0; i < numBranches; i++) {
            // Calculate organic angle splits
            let branchAngle;
            if (numBranches === 3) {
                // Splits: left, center, right
                const angles = [-0.45, 0, 0.45];
                branchAngle = adjustedAngle + angles[i] + (this.nextRandom() - 0.5) * 0.15;
            } else {
                // Splits: left and right
                const angles = [-0.38, 0.38];
                branchAngle = adjustedAngle + angles[i] + (this.nextRandom() - 0.5) * 0.12;
            }

            // Branches get shorter and thinner
            const lengthReduction = 0.72 + (this.nextRandom() * 0.08);
            const nextLength = length * lengthReduction;
            const nextThickness = thickness * 0.65;

            this.branch(
                ctx,
                endX,
                endY,
                nextLength,
                branchAngle,
                nextThickness,
                depth + 1,
                physics,
                leafNodes
            );
        }
    }
}
