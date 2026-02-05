const axios = require('axios');

async function test() {
    // Test the specific structure provided by user
    const brand = 'canyon';
    const min = 500;
    const max = 1200;
    const page = 2;

    // Construct URL
    let url = 'https://www.kleinanzeigen.de/s-fahrraeder/';
    url += `preis:${min}:${max}/`;
    url += `seite:${page}/`;
    url += `${brand}/`;
    url += 'k0c217';

    console.log(`\nFetching Generated URL: ${url}`);
    try {
        const res = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.kleinanzeigen.de/'
            }
        });
        console.log(`Status: ${res.status}`);
        console.log(`Data length: ${res.data.length}`);
    } catch (e) {
        console.error(`Error: ${e.message}`);
        if (e.response) console.error(`Status: ${e.response.status}`);
    }
}

test();
