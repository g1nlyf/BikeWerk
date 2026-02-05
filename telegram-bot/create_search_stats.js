const BikesDatabase = require('./bikes-database-node');
const db = new BikesDatabase();

(async () => {
    try {
        console.log('Initializing DB...');
        await db.ensureInitialized();
        console.log('Creating search_stats table...');
        await db.runQuery(`
            CREATE TABLE IF NOT EXISTS search_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                category TEXT NOT NULL,
                last_scanned_at DATETIME,
                total_found INTEGER DEFAULT 0,
                UNIQUE(brand, category)
            )
        `);
        console.log('search_stats table created successfully.');
        
        // Seed initial data if empty
        const count = await db.getQuery('SELECT COUNT(*) as c FROM search_stats');
        if (count.c === 0) {
            console.log('Seeding initial search stats...');
            const { BRAND_MODELS } = require('./BrandConstants');
            
            // Map BRAND_MODELS to flat list
            const categories = {
                'MTB': ['MTB DH', 'MTB Enduro', 'MTB Trail', 'MTB XC'],
                'Road': ['Road Aero', 'Road Endurance', 'Road Climbing', 'Road TT/Triathlon'],
                'Gravel': ['Gravel Race', 'Gravel All-road', 'Gravel Bikepacking'],
                'eMTB': ['eMTB']
            };

            const inserts = [];
            for (const [mainCat, subCats] of Object.entries(categories)) {
                const brands = new Set();
                subCats.forEach(sc => {
                    if (BRAND_MODELS[sc]) {
                        BRAND_MODELS[sc].brands.forEach(b => brands.add(b));
                    }
                });
                
                for (const brand of brands) {
                    inserts.push({ brand, category: mainCat.toLowerCase() });
                }
            }

            for (const item of inserts) {
                await db.runQuery(
                    'INSERT OR IGNORE INTO search_stats (brand, category, last_scanned_at) VALUES (?, ?, ?)',
                    [item.brand, item.category, new Date(0).toISOString()] // Old date to prioritize
                );
            }
            console.log(`Seeded ${inserts.length} brand/category pairs.`);
        }

    } catch (e) {
        console.error('Migration failed:', e);
    }
})();
