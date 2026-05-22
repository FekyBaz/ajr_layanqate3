/**
 * TreeState.js
 * Manages the counts, levels, scale factors, and smooth interpolations for the Tree of Goodness.
 */

export class TreeState {
    constructor() {
        this.config = {
            maxLeaves: 450,       // Upper visual limit for leaves to maintain performance and elegance
            maxStars: 200,        // Upper visual limit for glowing stars
            maxFlowers: 50,       // Upper visual limit for blossoms
            growthSpeed: 0.05,    // Easing speed for counts interpolation
        };

        // Raw counts received from the server/client
        this.rawStats = {
            dhikr: 0,
            shares: 0,
            featured: 0
        };

        // Interpolated visual counts (for smooth growth transitions)
        this.visualStats = {
            leaves: 0,
            stars: 0,
            flowers: 0,
            treeScale: 0.1 // Overall tree thickness/height growth multiplier [0.1 to 1.0]
        };
    }

    /**
     * Updates raw stats and computes target scales.
     * @param {number} approvedCount - Total approved dhikrs in community
     * @param {number} sharesCount - Total shares
     */
    update(approvedCount, sharesCount) {
        // Enforce basic positive values
        this.rawStats.dhikr = Math.max(0, approvedCount);
        this.rawStats.shares = Math.max(0, sharesCount);
        
        // Calculate a reasonable featured threshold (e.g. 1 flower per 10 approved dhikrs)
        this.rawStats.featured = Math.min(
            this.config.maxFlowers,
            Math.floor(this.rawStats.dhikr / 10)
        );
    }

    /**
     * Increments shares locally for immediate tactile visual response
     */
    incrementShareLocal() {
        this.rawStats.shares += 1;
    }

    /**
     * Interpolates visual stats towards their target values on every frame
     */
    tick() {
        // Target calculations using logarithmic scales so that even small numbers look beautiful
        // while large numbers don't overcrowd the canvas.
        const leafTarget = this.calculateTarget(this.rawStats.dhikr, 15, this.config.maxLeaves);
        const starTarget = this.calculateTarget(this.rawStats.shares, 8, this.config.maxStars);
        const flowerTarget = this.rawStats.featured;

        // Smooth linear interpolation (lerp)
        this.visualStats.leaves += (leafTarget - this.visualStats.leaves) * this.config.growthSpeed;
        this.visualStats.stars += (starTarget - this.visualStats.stars) * this.config.growthSpeed;
        this.visualStats.flowers += (flowerTarget - this.visualStats.flowers) * this.config.growthSpeed;

        // The tree's primary scale factor (starts at 0.5 for small trees, scales up to 1.0)
        const totalActivity = this.rawStats.dhikr + this.rawStats.shares;
        const targetScale = Math.min(1.0, 0.5 + Math.log10(1 + totalActivity) * 0.15);
        this.visualStats.treeScale += (targetScale - this.visualStats.treeScale) * 0.02; // grows extra slowly
    }

    /**
     * Helper to map activity count to beautiful visual numbers using log curves
     */
    calculateTarget(count, baseFactor, maxLimit) {
        if (count <= 0) return 0;
        // visualCount = baseFactor * ln(1 + count)
        const visualCount = Math.round(baseFactor * Math.log1p(count * 1.5));
        return Math.min(maxLimit, Math.max(5, visualCount));
    }
}
