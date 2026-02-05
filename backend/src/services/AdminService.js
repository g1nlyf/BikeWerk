const AdminService = {
    getFinanceSummary: async (config) => {
        const { commission = 0.10, logistics = 150 } = config;
        
        // Simulation logic
        // Avg bike price 2000
        const avgPrice = 2000;
        const grossMargin = avgPrice * commission; // 200
        const netProfit = grossMargin - logistics; // 50
        
        // Cost per Lead simulation
        // Assume conversion rate 2%
        // CPA = Marketing Spend / Conversions
        // This is a mock simulation for the "War Room"
        
        return {
            expectedProfit: netProfit,
            costPerLead: 15, // Mock value
            roi: (netProfit / logistics) * 100
        };
    }
};

module.exports = AdminService;
