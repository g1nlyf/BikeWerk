const axios = require('axios');
const https = require('https');

const agent = new https.Agent({  
  rejectUnauthorized: false
});

async function check() {
    const urls = [
        'https://45.9.41.232/api/bikes?limit=10',
        'https://45.9.41.232/api/catalog/bikes?limit=10',
        'http://45.9.41.232:8082/api/bikes?limit=10'
    ];

    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const res = await axios.get(url, { httpsAgent: agent, timeout: 5000 });
            console.log(`Status: ${res.status}`);
            if (res.data.bikes) {
                console.log(`Bikes found: ${res.data.bikes.length}`);
                if (res.data.bikes.length > 0) console.log('First bike:', res.data.bikes[0].name);
            } else {
                console.log('Response:', Object.keys(res.data));
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
            if (e.response) console.error(`Status: ${e.response.status}`);
        }
    }
}

check();
