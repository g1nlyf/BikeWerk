const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxy = 'http://user258350:otuspk@191.101.73.161:8984';
const agent = new HttpsProxyAgent(proxy);

async function debug() {
    try {
        console.log('Fetching OTP with Proxy...');
        const { data } = await axios.get('https://www.otpbank.ru/retail/currency/', {
            httpsAgent: agent,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'max-age=0',
                'Referer': 'https://www.google.com/'
            },
            timeout: 10000
        });
        
        console.log('Status:', 200);
        console.log('Length:', data.length);
        
        const $ = cheerio.load(data);
        const rows = $('.currency-table__row');
        console.log('Rows found:', rows.length);
        
        if (rows.length > 0) {
            // New Selector Strategy
            const eurRow = rows.eq(1);
            console.log('EUR Row Text:', eurRow.text().trim().substring(0, 100));
            
            const results = eurRow.find('.currency-table__row-result');
            console.log('Results found in EUR row:', results.length);
            
            results.each((j, res) => {
                console.log(`Result ${j}: ${$(res).text().trim()}`);
            });
            
            const sellRate = results.eq(1).text().trim();
            console.log('Target Sell Rate (Result 1):', sellRate);
        } else {
            console.log('No rows found. Dumping first 500 chars of HTML:');
            console.log(data.substring(0, 500));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

debug();