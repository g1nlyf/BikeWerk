const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../database/eubike_test.db');
console.log(`Seeding DB at: ${dbPath}`);

const db = new Database(dbPath);

async function seed() {
    // Clear tables
    db.prepare('DELETE FROM bikes').run();
    db.prepare('DELETE FROM market_history').run();
    db.prepare('DELETE FROM bike_analytics').run();
    
    // Config
    const brands = ['Specialized', 'Trek', 'Canyon', 'Cube', 'Giant', 'Santa Cruz', 'YT', 'Merida'];
    const tiers = { 'Specialized': 1, 'Trek': 2, 'Canyon': 1, 'Cube': 2, 'Giant': 3, 'Santa Cruz': 1, 'YT': 1, 'Merida': 3 };
    const models = ['Stumpjumper', 'Marlin', 'Spectral', 'Stereo', 'Talon', 'Megatower', 'Capra', 'Big Nine'];
    
    // Seed Bikes
    console.log('Seeding 500 bikes...');
    const insertBike = db.prepare(`
        INSERT INTO bikes (
            name, brand, model, year, price, fmv, tier, size, condition_status, 
            is_active, created_at, hotness_score, original_url, location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), ?, ?, ?)
    `);
    
    db.transaction(() => {
        for (let i = 0; i < 500; i++) {
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const model = models[Math.floor(Math.random() * models.length)];
            const year = 2018 + Math.floor(Math.random() * 7); // 2018-2024
            const price = 500 + Math.floor(Math.random() * 4000);
            const fmv = price * (0.8 + Math.random() * 0.4); // 0.8 - 1.2 ratio
            const tier = tiers[brand] || 2;
            const size = ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)];
            const condition = ['new', 'excellent', 'good', 'fair'][Math.floor(Math.random() * 4)];
            const isActive = Math.random() > 0.2 ? 1 : 0;
            const daysAgo = `-${Math.floor(Math.random() * 60)} days`;
            const hotness = Math.floor(Math.random() * 100);
            const name = `${brand} ${model} ${year} ${size}`;
            const location = 'Berlin';
            
            insertBike.run(name, brand, model, year, price, fmv, tier, size, condition, isActive, daysAgo, hotness, `http://example.com/bike${i}`, location);
        }
    })();
    
    // Seed Market History
    console.log('Seeding 2000 market history records...');
    const insertHistory = db.prepare(`
        INSERT INTO market_history (
            brand, model, year, price_eur, category, quality_score, 
            source_url, created_at, title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?), ?)
    `);
    
    db.transaction(() => {
        for (let i = 0; i < 2000; i++) {
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const model = models[Math.floor(Math.random() * models.length)];
            const year = 2018 + Math.floor(Math.random() * 7);
            const price = 500 + Math.floor(Math.random() * 4000);
            const category = ['Mountain', 'Road', 'Gravel'][Math.floor(Math.random() * 3)];
            const quality = 50 + Math.floor(Math.random() * 50);
            const daysAgo = `-${Math.floor(Math.random() * 180)} days`;
            
            insertHistory.run(brand, model, year, price, category, quality, `http://source.com/ad${i}`, daysAgo, `${brand} ${model} ${year}`);
        }
    })();
    
    // Update analytics (triggers should have handled insertion, but we update sold ones)
    // Actually, triggers only work if we insert via app logic or if triggers are active during seed.
    // better-sqlite3 respects triggers.
    // Let's verify and update some analytics to simulate sold state more accurately if triggers didn't catch everything or for sold bikes.
    
    console.log('Updating analytics for sold bikes...');
    db.prepare(`
        UPDATE bike_analytics 
        SET status = 'sold', sold_at = datetime('now')
        WHERE bike_id IN (SELECT id FROM bikes WHERE is_active = 0)
    `).run();
    
    console.log('✅ Seeding complete');
}

seed().catch(console.error);
