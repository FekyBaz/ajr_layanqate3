/**
 * RealtimeEngine.js
 * Synchronizes the tree stats with the community API endpoints
 * and listens for local user actions (like shares) to trigger immediate kinetic feedback.
 */

export class RealtimeEngine {
    /**
     * @param {TreeState} state 
     * @param {TreePhysics} physics 
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(state, physics, canvas) {
        this.state = state;
        this.physics = physics;
        this.canvas = canvas;
        this.pollInterval = null;
    }

    /**
     * Starts background synchronizations
     */
    start() {
        // Poll database statistics every 30 seconds silently
        this.pollInterval = setInterval(() => {
            this.syncStats();
        }, 30000);

        // Immediate initial sync
        this.syncStats();
    }

    /**
     * Stops background sync loops
     */
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }

    /**
     * Fetches current community statistics from the backend Netlify function API
     */
    async syncStats() {
        try {
            // Read from community API Endpoint (already loaded in community.js, or we can fetch directly)
            const response = await fetch('/.netlify/functions/community-submissions?page=1&limit=1&surface=community');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.stats) {
                    const totalApproved = result.pagination?.total || result.stats.totalApproved || 0;
                    const totalShares = result.stats.totalPostCount || 0;
                    
                    this.state.update(totalApproved, totalShares);
                    console.debug('[TreeRealtime] synced from API:', { totalApproved, totalShares });
                }
            }
        } catch (err) {
            console.warn('[TreeRealtime] silent stats poll failed:', err);
        }
    }

    /**
     * Triggers a shooting star golden light from the user click or a random corner
     * @param {MouseEvent} [clickEvent] - Optional click event to locate start coordinates
     */
    triggerShareVisualEffect(clickEvent) {
        // Increment visual counts locally for instant feedback
        this.state.incrementShareLocal();

        const canvasRect = this.canvas.getBoundingClientRect();
        let startX, startY;

        if (clickEvent && clickEvent.clientX && clickEvent.clientY) {
            // Map screen coordinates of user click to canvas space
            startX = clickEvent.clientX - canvasRect.left;
            startY = clickEvent.clientY - canvasRect.top;
        } else {
            // Pick a random lower corner as source if no click coordinates
            startX = Math.random() > 0.5 ? 20 : canvasRect.width - 20;
            startY = canvasRect.height - 20;
        }

        // Random target branch node in the upper canopy
        const targetX = canvasRect.width / 2 + (Math.random() - 0.5) * (canvasRect.width * 0.4);
        const targetY = canvasRect.height * 0.25 + Math.random() * (canvasRect.height * 0.35);

        // Spawn kinetic particle in Physics system
        this.physics.spawnShootingParticle(startX, startY, targetX, targetY);

        // Bind explosion visual callback
        const particleIndex = this.physics.shootingParticles.length - 1;
        const particle = this.physics.shootingParticles[particleIndex];
        
        if (particle) {
            particle.onComplete = (tx, ty) => {
                // Flash golden point glow in atmospheric renderer
                window.dispatchEvent(new CustomEvent('tree-star-burst', {
                    detail: { x: tx, y: ty }
                }));
            };
        }
    }
}
