const axios = require('axios');

async function testFrontendIntegration() {
    console.log("=== Тест Frontend Integration (API Fields) ===");
    const API_URL = 'http://127.0.0.1:8082';
    
    try {
        // Try to fetch bike 1001 (or any existing bike)
        // Since DB is mocked/seeded, I might need to know a valid ID.
        // BikesDatabase generates IDs starting from 1. 1001 might not exist unless added.
        // Let's try ID 1.
        
        const id = 1001;
        console.log(`Fetching bike ${id}...`);
        const response = await axios.get(`${API_URL}/api/bikes/${id}`);
        console.log("Response Data Structure:", Object.keys(response.data));
        const bike = response.data.bike || response.data; // Try nested 'bike' field
        
        if (!bike || Object.keys(bike).length === 0) {
            console.error("Bike not found or empty");
            console.log("Full Response:", JSON.stringify(response.data, null, 2));
            return;
        }
        
        console.log("Bike fetched:", bike.name || bike.brand);
        
        // Check for condition_report fields
        // In the user's plan: condition_report.class, condition_report.justification, etc.
        // In my mysql-config.js (initSQL), I saw columns: condition_score, condition_grade, condition_reason.
        // I need to see if the API returns them nested in 'condition_report'.
        
        if (bike.condition_report) {
            console.log("✅ condition_report found");
            console.log("Class:", bike.condition_report.class || bike.condition_report.grade);
            console.log("Technical Score:", bike.condition_report.technical_score);
        } else {
            // Check flat fields if not nested
            if (bike.condition_grade || bike.condition_score) {
                console.log("⚠️ condition_report not nested, but fields exist:");
                console.log("Grade:", bike.condition_grade);
                console.log("Score:", bike.condition_score);
            } else {
                console.log("❌ Condition fields missing");
            }
        }
        
    } catch (e) {
        console.error("API Error:", e.message, e.response?.status);
    }
}

testFrontendIntegration();
