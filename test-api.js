const axios = require('axios');

async function testApi() {
    try {
        // First get a bike ID
        // Or just try ID 1
        const id = 1; 
        console.log(`Testing /api/market/compare/${id}...`);
        
        const response = await axios.get(`http://localhost:8082/api/market/compare/${id}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        if (error.response) {
             console.log(`Error ${error.response.status}:`, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testApi();
