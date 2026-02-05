const axios = require('axios');

async function debugCatalog() {
    console.log('🐞 Debugging Catalog Flow...');
    const API_URL = 'http://localhost:8082/api/bikes?limit=10';
    
    try {
        console.log(`🌐 Fetching ${API_URL}...`);
        const res = await axios.get(API_URL);
        
        if (res.data && res.data.bikes) {
            console.log(`✅ Success! Received ${res.data.bikes.length} bikes.`);
            if (res.data.bikes.length > 0) {
                const b = res.data.bikes[0];
                console.log('🔍 First Bike Sample:');
                console.log(`   - ID: ${b.id}`);
                console.log(`   - Name: ${b.name}`);
                console.log(`   - Main Image (Raw DB): ${b.main_image}`);
                console.log(`   - Is Active: ${b.is_active}`);
                console.log(`   - Price: ${b.price}`);
            } else {
                console.warn('⚠️ Response valid but array is empty. Check DB "is_active" flags.');
            }
        } else {
            console.error('❌ Unexpected response format:', res.data);
        }
    } catch (e) {
        console.error(`❌ API Request Failed: ${e.message}`);
        if (e.code === 'ECONNREFUSED') {
            console.log('   (Is the server running on port 8081?)');
        }
    }
}

debugCatalog();
