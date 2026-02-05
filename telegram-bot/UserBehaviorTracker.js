
class UserBehaviorTracker {
    constructor() {
        this.events = [];
        this.batchSize = 20;
        this.lastFlush = Date.now();
        this.flushInterval = 30000; // 30s
    }

    /**
     * Tracks a user interaction event
     * @param {Object} event 
     * @param {string} event.type - TAP_ENGAGEMENT, SCROLL_VELOCITY, IMAGE_SWIPE, SEARCH_GAP
     * @param {string} event.targetId - Bike ID or Search Query
     * @param {number} event.value - e.g. scroll depth or velocity
     * @param {string} event.userId - Anonymous ID
     */
    track(event) {
        this.events.push({
            ...event,
            timestamp: Date.now()
        });

        if (this.events.length >= this.batchSize || (Date.now() - this.lastFlush > this.flushInterval)) {
            this.flush();
        }
    }

    async flush() {
        if (this.events.length === 0) return;

        const batch = [...this.events];
        this.events = [];
        this.lastFlush = Date.now();

        console.log(`📡 [BehaviorTracker] Flushing ${batch.length} events to Analytics Lake...`);
        
        // Group by type for console reporting (simulating analytics backend)
        const summary = batch.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {});
        
        console.log('   📊 Batch Summary:', JSON.stringify(summary));

        // In a real system, this would POST to an endpoint or save to DB
        // For now, we simulate saving to a specialized table or log
        // await db.saveAnalytics(batch);
    }

    /**
     * Calculates User Interest Score for a specific item based on recent events
     * @param {string} bikeId 
     * @returns {number} 0-10 Score
     */
    async getUserInterestScore(bikeId) {
        // This would query the analytics DB for aggregated metrics over last 24h
        // Simulating a dynamic score for now
        // Factors:
        // - Unique Taps (High Weight)
        // - Image Swipes (Medium Weight)
        // - Scroll Depth (Low Weight)
        
        // Mock return for now
        return Math.floor(Math.random() * 3); // 0-2 low baseline interest
    }
}

module.exports = UserBehaviorTracker;
