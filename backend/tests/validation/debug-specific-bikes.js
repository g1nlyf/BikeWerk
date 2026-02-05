const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const KleinanzeigenCollector = require('../../src/scrapers/kleinanzeigen-collector');
const BuycycleCollector = require('../../scrapers/buycycle-collector');
const KleinanzeigenPreprocessor = require('../../src/services/KleinanzeigenPreprocessor');
const BuycyclePreprocessor = require('../../src/services/BuycyclePreprocessor');
const UnifiedNormalizer = require('../../src/services/UnifiedNormalizer');
const geminiProcessor = require('../../src/services/geminiProcessor');

puppeteer.use(StealthPlugin());

const TARGETS = [
    {
        url: 'https://buycycle.com/de-de/product/gambler-920-2020-95303',
        source: 'buycycle',
        expected: {
            title: 'Scott Gambler 920 2020',
            price: 1945,
            year: 2020,
            fork: 'FOX 40 Performance Elite',
            shock: 'Fox Van Performance',
            brakes: 'Shimano BR 520',
            groupset: 'SRAM GX'
        }
    },
    {
        url: 'https://www.kleinanzeigen.de/s-anzeige/commencal-meta-sx-v4-fully-enduro-mountainbike-m/3312561736-217-8181',
        source: 'kleinanzeigen',
        expected: {
            title: 'Commencal Meta Sx V4',
            price: 2499,
            fork: 'FOX 38 Performance',
            shock: 'FOX Float X Performance',
            brakes: 'SHIMANO SLX',
            groupset: 'SHIMANO SLX'
        }
    }
];

const runDebug = async () => {
    console.log('🐞 DEBUG: Specific Bike Parsing');
    
    for (const target of TARGETS) {
        console.log(`\n\n🔎 Analyzing: ${target.url} (${target.source})`);
        
        let browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        let page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        try {
            await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            const html = await page.content();
            
            let preprocessed;
            
            if (target.source === 'buycycle') {
                const $ = cheerio.load(html);
                const nextData = BuycyclePreprocessor.extractNextData($);
                const product = BuycyclePreprocessor.resolveProduct(nextData);
                
                // Debug raw extraction
                console.log('   📦 Buycycle Raw Product Found:', !!product);
                if (product) {
                    console.log('   🔍 Raw Components:', JSON.stringify(product.components || {}, null, 2));
                }

                preprocessed = BuycyclePreprocessor.preprocess({
                    html,
                    url: target.url,
                    title: target.expected.title, // Simulating what collector passes
                    price: target.expected.price
                });
            } else {
                // Kleinanzeigen
                preprocessed = KleinanzeigenPreprocessor.preprocess({
                    html,
                    url: target.url,
                    title: target.expected.title,
                    price: target.expected.price,
                    description: 'Simulated Description' // Collector usually passes this
                });
            }

            console.log('   🛠️ Preprocessed Data:', JSON.stringify(preprocessed, null, 2));

            // Gemini Normalization
            const prompt = geminiProcessor.buildUnifiedPrompt(preprocessed, target.source);
            console.log('   🤖 Sending to Gemini...');
            
            const normalized = await geminiProcessor.callGeminiAPI(prompt);
            console.log('   ✨ Gemini Raw Result:', JSON.stringify(normalized, null, 2));

            const unified = UnifiedNormalizer.postProcess(normalized, preprocessed, target.source);
            console.log('   ✅ Final Unified Data:', JSON.stringify(unified, null, 2));

            // Validation against expected
            console.log('\n   🧪 Validation:');
            const checks = [
                { field: 'Fork', actual: unified.specs?.fork, expected: target.expected.fork },
                { field: 'Shock', actual: unified.specs?.shock, expected: target.expected.shock },
                { field: 'Brakes', actual: unified.specs?.brakes, expected: target.expected.brakes },
                { field: 'Groupset', actual: unified.specs?.groupset, expected: target.expected.groupset }
            ];

            checks.forEach(check => {
                const match = String(check.actual || '').toLowerCase().includes(String(check.expected || '').toLowerCase());
                console.log(`   ${match ? '✅' : '❌'} ${check.field}: "${check.actual}" (Expected: "${check.expected}")`);
            });

        } catch (e) {
            console.error('   ❌ Error:', e);
        } finally {
            await browser.close();
        }
    }
};

runDebug();
