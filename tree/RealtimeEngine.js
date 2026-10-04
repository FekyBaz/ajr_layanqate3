/**
 * RealtimeEngine.js (Upgraded Cinematic Version)
 * Integrates statistics sync with backend serverless endpoints,
 * and tracks user clicks to shoot light particles directly onto organic branch growth nodes.
 */

export class RealtimeEngine {
    constructor(state, physics, canvas) {
        this.state = state;
        this.physics = physics;
        this.canvas = canvas;
        this.pollInterval = null;
    }

    /**
     * Start background stats sync polling loop (idempotent).
     */
    start() {
        if (this.pollInterval) return;
        this.pollInterval = setInterval(() => {
            this.syncStats();
        }, 30000);

        this.syncStats();
    }

    /**
     * Stop background sync polling loop
     */
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * Silent statistics polling from netlify serverless functions.
     * Skipped while the tab is hidden (belt-and-braces alongside
     * the TreeView visibility handling, see #147).
     */
    async syncStats() {
        try {
            if (typeof document !== 'undefined' && document.hidden) return;
            const response = await fetch('/.netlify/functions/community-submissions?page=1&limit=1&surface=community');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.stats) {
                    const totalApproved = result.pagination?.total || result.stats.totalApproved || 0;
                    const totalShares = result.stats.totalPostCount || 0;

                    this.state.update(totalApproved, totalShares);
                }
            }
        } catch (err) {
            console.warn('[TreeRealtime] background stats sync failed:', err);
        }
    }

    /**
     * Triggers a curved shooting particle starting from the user's click coordinate
     * and landing exactly on an active branch node.
     */
    triggerShareVisualEffect(clickEvent) {
        // Increment visual counts locally for instant feedback loop
        this.state.incrementShareLocal();

        const canvasRect = this.canvas.getBoundingClientRect();
        let startX, startY;

        if (clickEvent && clickEvent.clientX !== undefined && clickEvent.clientY !== undefined) {
            // Map screen click positions to Canvas local coordinate system
            startX = clickEvent.clientX - canvasRect.left;
            startY = clickEvent.clientY - canvasRect.top;
        } else {
            // Fallback starting coordinates (random lower corner)
            startX = Math.random() > 0.5 ? 20 : canvasRect.width - 20;
            startY = canvasRect.height - 20;
        }

        // Find the absolute perfect target coordinate (an actual branch growth tip!)
        let targetX = canvasRect.width / 2;
        let targetY = canvasRect.height * 0.45;
        let selectedNode = null;

        // Retrieve the live active leaf node points calculated by the animations boughs
        const activeNodes = window.GlobalTreeOfGoodnessInstance ? 
                            window.GlobalTreeOfGoodnessInstance.activeLeafNodes : null;

        if (activeNodes && activeNodes.length > 0) {
            // Select a random branch growth node in the upper foliage canopy
            const randomIndex = Math.floor(Math.random() * activeNodes.length);
            selectedNode = activeNodes[randomIndex];
            targetX = selectedNode.x;
            targetY = selectedNode.y;
        } else {
            // Fallback coordinate in the general tree canopy space
            targetX = canvasRect.width / 2 + (Math.random() - 0.5) * (canvasRect.width * 0.35);
            targetY = canvasRect.height * 0.32 + Math.random() * (canvasRect.height * 0.32);
        }

        // Spawn kinetics particle in Physics system
        this.physics.spawnShootingParticle(startX, startY, targetX, targetY);

        // Bind explosion starburst callback upon landing
        const particleIndex = this.physics.shootingParticles.length - 1;
        const particle = this.physics.shootingParticles[particleIndex];
        
        if (particle) {
            particle.onComplete = (tx, ty) => {
                // Dispatch radial point flash at the landing coordinate
                window.dispatchEvent(new CustomEvent('tree-star-burst', {
                    detail: { x: tx, y: ty }
                }));
            };
        }
    }
}
