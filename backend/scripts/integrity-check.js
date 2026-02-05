const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

async function checkApi() {
    const url = 'http://localhost:8082/api/bikes';
    console.log(`Testing API at ${url}...`);

    try {
        const res = await axios.get(url, { timeout: 2000 });
        console.log(`✅ API Online. Status: ${res.status}`);
        console.log(`🚲 Bikes Found: ${Array.isArray(res.data) ? res.data.length : 'Not an array'}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
            const b = res.data[0];
            console.log(`   Sample: ${b.brand} ${b.model} (${b.price} EUR)`);
        } else {
            console.warn('⚠️ API returned empty list!');
        }
    } catch (e) {
        console.error(`❌ API Check Failed: ${e.message}`);
        if (e.code === 'ECONNREFUSED') {
            console.log('🔄 Server seems down. Please start the server manually or let me start it.');
        }
    }
}

checkApi();
