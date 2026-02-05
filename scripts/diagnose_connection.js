const https = require('https');
const { exec } = require('child_process');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        }).on('error', reject);
    });
}

async function checkIp() {
    console.log('\n🌍 Checking IP Location...');
    try {
        const data = await fetchJson('https://ipapi.co/json/');
        console.log(`   IP: ${data.ip}`);
        console.log(`   City: ${data.city}`);
        console.log(`   Region: ${data.region}`);
        console.log(`   Country: ${data.country_name} (${data.country_code})`);
        console.log(`   Org: ${data.org}`);
    } catch (e) {
        console.log('   ❌ Failed to check IP:', e.message);
    }
}

async function run() {
    await checkIp();
    
    console.log('\n🔎 Checking for Proxy Config in Process...');
    console.log('   HTTP_PROXY:', process.env.HTTP_PROXY);
    console.log('   HTTPS_PROXY:', process.env.HTTPS_PROXY);
    console.log('   ALL_PROXY:', process.env.ALL_PROXY);
}

run();
