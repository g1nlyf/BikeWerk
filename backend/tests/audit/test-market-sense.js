const axios = require('axios');

async function testMarketSense() {
    console.log("=== Тест Market Sense (Supply Gap Analyzer) ===");
    
    const API_URL = 'http://127.0.0.1:8082';
    
    // 1. Simulate 5 empty searches for Gravel L
    console.log("Simulating 5 empty searches for Gravel L...");
    for (let i = 0; i < 5; i++) {
        try {
            await axios.post(`${API_URL}/api/tg/preferences`, {
                chatId: "test",
                category: "Gravel",
                size: "L"
            });
        } catch (e) {
            console.log(`Search ${i+1} failed:`, e.message, e.response?.status, e.response?.data);
        }
    }
    
    // 2. Call market analytics
    console.log("Calling market analytics...");
    try {
        const response = await axios.get(`${API_URL}/api/admin/analytics/market`);
        console.log("Market Analytics Response:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.log("Analytics call failed:", e.message, e.response?.status, e.response?.data);
    }
}

testMarketSense();
