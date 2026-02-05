const axios = require('axios');

async function test() {
    // Pagination test
    const url1 = 'https://www.kleinanzeigen.de/s-fahrraeder/k0c217?keywords=stevens&page=2';
    const url2 = 'https://www.kleinanzeigen.de/s-fahrraeder/seite:2/k0c217?keywords=stevens';

    const urls = [url1, url2];

    for (const url of urls) {
        console.log(`\nFetching: ${url}`);
        try {
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            console.log(`Status: ${res.status}`);
            // Check if page 2 is actually loaded? Hard to check without parsing content.
            // But status 200 is good start.
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

test();
