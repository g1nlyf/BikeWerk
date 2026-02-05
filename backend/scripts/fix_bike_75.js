const Database = require('better-sqlite3');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const KleinanzeigenPreprocessor = require('../src/services/KleinanzeigenPreprocessor');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer');

puppeteer.use(StealthPlugin());

async function fixBike75() {
    const dbPath = path.join(__dirname, '../database/eubike.db');
    const db = new Database(dbPath);

    // 1. Get URL
    const bike = db.prepare('SELECT * FROM bikes WHERE id = ?').get(75);
    if (!bike) {
        console.error('Bike 75 not found');
        return;
    }
    const targetUrl = bike.source_url || bike.original_url;
    console.log(`Processing bike 75: ${targetUrl}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set User Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('Navigating to page...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const html = await page.content();
        
        // 1. Preprocess
        console.log('Preprocessing...');
        const preprocessed = KleinanzeigenPreprocessor.preprocess({
            html,
            url: targetUrl,
            id: 75
        });
        
        console.log(`Found ${preprocessed.images?.length || 0} images`);
        if (preprocessed.images?.length > 0) {
            console.log('First 3 images:', preprocessed.images.slice(0, 3));
        }
        console.log('Preprocessed Attributes:', JSON.stringify(preprocessed.general_info, null, 2));

        // 2. Normalize (AI)
        console.log('Normalizing with AI...');
        // UnifiedNormalizer.normalize expects the preprocessed object
        // It uses GeminiProcessor internally
        const normalized = await UnifiedNormalizer.normalize(preprocessed);
        
        console.log('Normalized Data Summary:');
        console.log('- Condition Score:', normalized.condition?.score);
        console.log('- Condition Grade:', normalized.condition?.grade);
        console.log('- Condition Verdict:', normalized.condition?.technical_verdict);
        console.log('- Attributes:', JSON.stringify(normalized.specs || {}, null, 2));
        console.log('- Gallery Count:', normalized.media?.gallery?.length);

        // 3. Update DB
        // We need to update: data (json), images (json), condition_score, price, title, description, etc.
        const stmt = db.prepare(`
            UPDATE bikes 
            SET 
                data = ?,
                images = ?,
                name = ?,
                description = ?,
                price = ?,
                condition_score = ?,
                condition_grade = ?,
                ai_specs = ?
            WHERE id = ?
        `);

        // Prepare JSON data
        // Ensure we preserve what we have and add new stuff
        const newData = {
            ...JSON.parse(bike.data || '{}'),
            ...normalized
        };

        const gallery = normalized.media?.gallery || normalized.images || [];

        stmt.run(
            JSON.stringify(newData),
            JSON.stringify(gallery),
            normalized.title || bike.name,
            normalized.description || bike.description,
            normalized.price || bike.price,
            normalized.condition?.score || 50,
            normalized.condition?.grade || 'unknown',
            JSON.stringify(normalized.specs || {}),
            75
        );

        console.log('Successfully updated bike 75 in database.');

    } catch (e) {
        console.error('Error processing bike 75:', e);
    } finally {
        await browser.close();
        db.close();
    }
}

fixBike75();
