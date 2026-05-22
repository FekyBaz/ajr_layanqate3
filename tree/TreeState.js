/**
 * TreeState.js (Upgraded Cinematic Version)
 * Manages organic stats interpolation, structural growth stages,
 * and outputs smooth floating-point structural values for organic branch sprouting.
 */

export class TreeState {
    constructor() {
        this.config = {
            maxLeavesLimit: 400,
            maxStarsLimit: 180,
            maxFlowersLimit: 40,
            growthSpeed: 0.025, // Calm, slow transitions
        };

        // Raw counts from API / user interactions
        this.rawStats = {
            dhikr: 0,
            shares: 0,
            featured: 0
        };

        // Smoothly interpolated statistics for visual rendering
        this.visualStats = {
            leaves: 0,
            stars: 0,
            flowers: 0,
            
            // Structural parameters (lerped across growth stages)
            treeScale: 0.35,          // Height & thickness scale [0.35 to 1.0]
            recursionDepth: 3.0,      // Dynamic floating-point recursion depth [3.0 to 6.8]
            branchLengthFactor: 0.68, // Branch length reduction factor [0.68 to 0.76]
            windSwaySensitivity: 0.06 // Overall susceptibility to wind
        };
    }

    /**
     * Updates stats and computes target parameters.
     * @param {number} approvedCount 
     * @param {number} sharesCount 
     */
    update(approvedCount, sharesCount) {
        this.rawStats.dhikr = Math.max(0, approvedCount);
        this.rawStats.shares = Math.max(0, sharesCount);
        
        // Lilac flowers represent milestone achievements (1 per 12 approved contributions)
        this.rawStats.featured = Math.min(
            this.config.maxFlowersLimit,
            Math.floor(this.rawStats.dhikr / 12)
        );
    }

    /**
     * Local trigger for immediate tactile feedback
     */
    incrementShareLocal() {
        this.rawStats.shares += 1;
    }

    /**
     * Core animation tick. Interpolates visual counts and calculates growth stage parameters.
     */
    tick() {
        const totalActivity = this.rawStats.dhikr + this.rawStats.shares;

        // --- 5 GROWTH STAGES LOGIC ---
        let targetScale = 0.4;
        let targetDepth = 3.0;
        let targetLengthFactor = 0.68;
        let targetWindSensitivity = 0.07;
        
        let targetLeafCount = 0;
        let targetStarCount = 0;

        if (totalActivity < 15) {
            // Stage 1: The Sprout / Budding Sapling (البذرة والأغصان الأولى)
            targetScale = 0.42;
            targetDepth = 3.2;
            targetLengthFactor = 0.68;
            targetWindSensitivity = 0.08;
            targetLeafCount = Math.min(18, totalActivity * 2.5);
            targetStarCount = Math.min(6, this.rawStats.shares * 1.5);
        } else if (totalActivity < 50) {
            // Stage 2: The Rising Plant (الفسيلة الناشئة)
            const t = (totalActivity - 15) / 35; // lerp helper [0 to 1]
            targetScale = 0.42 + t * 0.13; // 0.42 -> 0.55
            targetDepth = 3.2 + t * 1.0;   // 3.2 -> 4.2
            targetLengthFactor = 0.68 + t * 0.02; // 0.68 -> 0.70
            targetWindSensitivity = 0.08 - t * 0.01; // 0.08 -> 0.07
            targetLeafCount = 18 + t * 45; // 18 -> 63
            targetStarCount = 6 + t * 14;  // 6 -> 20
        } else if (totalActivity < 150) {
            // Stage 3: The Young Tree (الشجرة الفتية)
            const t = (totalActivity - 50) / 100;
            targetScale = 0.55 + t * 0.15; // 0.55 -> 0.70
            targetDepth = 4.2 + t * 1.0;   // 4.2 -> 5.2
            targetLengthFactor = 0.70 + t * 0.02; // 0.70 -> 0.72
            targetWindSensitivity = 0.07 - t * 0.015; // 0.07 -> 0.055
            targetLeafCount = 63 + t * 110; // 63 -> 173
            targetStarCount = 20 + t * 40;  // 20 -> 60
        } else if (totalActivity < 350) {
            // Stage 4: The Flourishing Tree (الشجرة المثمرة)
            const t = (totalActivity - 150) / 200;
            targetScale = 0.70 + t * 0.18; // 0.70 -> 0.88
            targetDepth = 5.2 + t * 1.1;   // 5.2 -> 6.3
            targetLengthFactor = 0.72 + t * 0.02; // 0.72 -> 0.74
            targetWindSensitivity = 0.055 - t * 0.015; // 0.055 -> 0.04
            targetLeafCount = 173 + t * 150; // 173 -> 323
            targetStarCount = 60 + t * 70;   // 60 -> 130
        } else {
            // Stage 5: The Majestic Spiritual Oasis (الواحة الروحانية المكتملة)
            const excess = Math.min(1000, totalActivity - 350);
            const t = excess / 1000; // asymptotic growth scaling
            targetScale = 0.88 + t * 0.12; // 0.88 -> 1.00
            targetDepth = 6.3 + t * 0.5;   // 6.3 -> 6.8
            targetLengthFactor = 0.74 + t * 0.02; // 0.74 -> 0.76
            targetWindSensitivity = 0.04 - t * 0.01; // 0.04 -> 0.03
            
            // Map actual activities directly above stage 5 with log curve comfort limits
            targetLeafCount = Math.min(this.config.maxLeavesLimit, 323 + Math.round(50 * Math.log1p(excess * 0.1)));
            targetStarCount = Math.min(this.config.maxStarsLimit, 130 + Math.round(30 * Math.log1p(this.rawStats.shares * 0.1)));
        }

        // Smoothly interpolate visual stats to prevent sudden popping (cinematic ease)
        const speed = this.config.growthSpeed;
        this.visualStats.leaves += (targetLeafCount - this.visualStats.leaves) * speed;
        this.visualStats.stars += (targetStarCount - this.visualStats.stars) * speed;
        this.visualStats.flowers += (this.rawStats.featured - this.visualStats.flowers) * speed;

        this.visualStats.treeScale += (targetScale - this.visualStats.treeScale) * 0.015; // Grows very slowly & gracefully
        this.visualStats.recursionDepth += (targetDepth - this.visualStats.recursionDepth) * 0.015;
        this.visualStats.branchLengthFactor += (targetLengthFactor - this.visualStats.branchLengthFactor) * 0.015;
        this.visualStats.windSwaySensitivity += (targetWindSensitivity - this.visualStats.windSwaySensitivity) * 0.015;
    }
}
