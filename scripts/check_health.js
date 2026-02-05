const http = require('http');
const https = require('https');

const config = {
    frontend: 'https://45.9.41.232',
    backend_proxy: 'https://45.9.41.232/api/bikes/popular',
};

async function check(url) {
    return new Promise((resolve) => {
        console.log(`Checking ${url}...`);
        const client = url.startsWith('https') ? https : http;
        const options = {};
        if (url.startsWith('https')) {
            options.rejectUnauthorized = false; // Ignore self-signed certs
        }
        
        const req = client.get(url, options, (res) => {
            console.log(`[${url}] Status: ${res.statusCode}`);
            if (res.statusCode === 301 || res.statusCode === 302) {
                console.log(`[${url}] Redirect to: ${res.headers.location}`);
            }
            if (res.statusCode >= 200 && res.statusCode < 400) {
                 console.log(`[${url}] Success`);
            } else {
                 console.log(`[${url}] Warning: Status ${res.statusCode}`);
            }
            resolve();
        });
        req.on('error', (e) => {
            console.error(`[${url}] Error: ${e.message}`);
            resolve();
        });
    });
}

async function main() {
    console.log('Checking services health...');
    await check(config.frontend);
    await check(config.backend_proxy);
}

main();