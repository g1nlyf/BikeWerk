/**
 * debug-single-bike.js
 * Детальная диагностика обработки ОДНОГО байка
 */

const collector = require('../scrapers/buycycle-collector');
const normalizer = require('../src/services/UnifiedNormalizer');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugSingleBike() {
    console.log('🔬 ДИАГНОСТИКА ОДНОГО БАЙКА\n');

    // Hardcoded тестовый URL (возьми любой из логов)
    const testUrl = 'https://www.buycycle.com/de/bike/santa-cruz-hightower-s-carbon-c-29-2020-2204441';
    
    console.log(`📍 Test URL: ${testUrl}\n`);

    // MOCK DATA FOR DEBUGGING GEMINI
    const rawData = {
        title: "YT IZZO Pro 2020",
        brand: "YT",
        model: "IZZO Pro",
        year: 2020,
        price: "1726",
        currency: "EUR",
        url: "https://buycycle.com/de-de/shop/min-price/1500/max-price/8000/search/YT%20Izzo", 
        source: "buycycle",
        description: "Новые детали: кассета, цепь, передняя звезда (30t), тормозные колодки, грипсы, задняя шина. Вилка и амортизатор обслужены. Есть царапины (см. фото). Велосипед в отличном техническом состоянии.",
        images: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
        components: {
            frame: "Carbon",
            fork: "Fox 34 Performance Elite",
            shock: "Fox Float DPS Performance Elite",
            groupset: "SRAM GX Eagle"
        }
    };

    /* SKIP SCRAPING FOR GEMINI DEBUGGING
    let browser;
    try {
        // 1. Scraping
        console.log('🕷️ ЭТАП 1: SCRAPING');
        
        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        const rawData = await collector.scrapeListingDetails(page);
        
        console.log('✅ Raw data extracted:');
        console.log(JSON.stringify(rawData, null, 2).substring(0, 500) + '...\n');
        
        // Сохраним raw data в файл для анализа
        fs.writeFileSync(
            path.join(__dirname, 'debug-raw-data.json'),
            JSON.stringify(rawData, null, 2)
        );
        console.log('💾 Saved to: debug-raw-data.json\n');

        await browser.close();
        browser = null; // Prevent double close in finally
    */
    
    try {
        // Сохраним MOCK raw data в файл для анализа
        fs.writeFileSync(
            path.join(__dirname, 'debug-raw-data.json'),
            JSON.stringify(rawData, null, 2)
        );
        console.log('💾 Saved MOCK data to: debug-raw-data.json\n');

        // 2. Normalization
        console.log('🤖 ЭТАП 2: AI NORMALIZATION');
        
        // ПАТЧ: Включаем debug mode в GeminiProcessor
        // UnifiedNormalizer exports a singleton instance
        if (normalizer.gemini) {
             normalizer.gemini.debugMode = true;
        } else if (normalizer.geminiProcessor) {
             normalizer.geminiProcessor.debugMode = true;
        } else {
             console.warn('⚠️ Could not find gemini instance in normalizer');
        }
        
        const normalized = await normalizer.normalize(rawData, 'buycycle');
        
        console.log('\n✅ Normalized result:');
        console.log(JSON.stringify(normalized, null, 2).substring(0, 500) + '...\n');

        // Сохраним normalized в файл
        fs.writeFileSync(
            path.join(__dirname, 'debug-normalized.json'),
            JSON.stringify(normalized, null, 2)
        );
        console.log('💾 Saved to: debug-normalized.json\n');

        // 3. Проверка критичных полей
        console.log('🔍 ЭТАП 3: VALIDATION');
        const criticalFields = [
            'basic_info.brand',
            'basic_info.model',
            'basic_info.year',
            'basic_info.category',
            'basic_info.discipline'
        ];

        criticalFields.forEach(field => {
            const value = getNestedValue(normalized, field);
            const status = value ? '✅' : '❌';
            console.log(`${status} ${field}: ${value || 'MISSING'}`);
        });

        console.log('\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА');
        console.log('📂 Проверь файлы:');
        console.log('   - debug-raw-data.json (что scraper извлёк)');
        console.log('   - debug-normalized.json (что AI вернул)');
        console.log('   - debug-gemini-response.txt (RAW ответ AI)\n');
        console.log('   - debug-prompt.txt (Prompt отправил AI)\n');

    } catch (error) {
        console.error('❌ ОШИБКА:', error.message);
        console.error(error.stack);
    }
    // finally block removed as browser is skipped
    
    process.exit(0);
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

debugSingleBike();
