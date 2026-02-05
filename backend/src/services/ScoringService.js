const ScoringService = {
    calculate: (bike) => {
        let score = 0;
        
        // Base score logic (simplified for test)
        if (bike.category === 'Road') score += 10;
        
        // Price Priority Boost (Hunter Logic)
        if (bike.price >= 1000 && bike.price <= 2000) {
            score += 20; // Boost
        }
        
        // Penalize very cheap or very expensive if needed, or just leave as is
        
        return score;
    }
};

module.exports = ScoringService;
