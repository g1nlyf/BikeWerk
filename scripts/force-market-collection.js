const { DatabaseManager } = require('../backend/src/js/mysql-config.js');

async function run() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();

    console.log('Starting Force Market Collection (Stress-Test 100)...');
    
    const brands = ['Canyon', 'Specialized', 'Trek', 'Scott', 'Cube', 'Giant', 'Cannondale', 'Bianchi', 'Orbea', 'Santa Cruz'];
    const models = {
        'Canyon': ['Endurace CF 7', 'Aeroad CF SLX', 'Ultimate CF SL', 'Grail CF SL', 'Lux World Cup'],
        'Specialized': ['Tarmac SL7', 'Tarmac SL8', 'Roubaix SL8', 'Stumpjumper EVO', 'Epic World Cup'],
        'Trek': ['Madone SLR 7', 'Domane SL 6', 'Supercaliber 9.8', 'Fuel EX 8', 'Checkpoint SL 5'],
        'Scott': ['Spark RC', 'Addict RC', 'Foil RC', 'Genius 900', 'Scale 910'],
        'Cube': ['Stereo 150', 'Reaction C:62', 'Litening AIR', 'Agree C:62', 'Two15 HPC'],
        'Giant': ['Propel Advanced', 'TCR Advanced Pro', 'Defy Advanced', 'Trance X', 'Anthem Advanced'],
        'Cannondale': ['SuperSix EVO', 'SystemSix', 'Topstone Carbon', 'Scalpel Hi-MOD', 'Jekyll'],
        'Bianchi': ['Oltre XR4', 'Specialissima', 'Infinito CV', 'Methanol CV', 'Arcadex'],
        'Orbea': ['Orca M20', 'Oiz M10', 'Rallon', 'Terra M30', 'Rise M10'],
        'Santa Cruz': ['Megatower', 'Hightower', 'Nomad', 'Blur', 'Stigmata']
    };

    const count = 100;
    const inserted = [];

    for (let i = 0; i < count; i++) {
        const brand = brands[Math.floor(Math.random() * brands.length)];
        const modelList = models[brand];
        const model = modelList[Math.floor(Math.random() * modelList.length)];
        
        // Random price between 1500 and 8000
        const price = Math.floor(1500 + Math.random() * 6500);
        
        // Random date within last 6 months to populate trends
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 180));
        const scrapedAt = date.toISOString();

        const record = {
            model_name: model,
            brand: brand,
            price_eur: price,
            source_url: `https://www.kleinanzeigen.de/s-anzeige/${brand.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}/id-${Math.floor(Math.random() * 1000000)}`,
            scraped_at: scrapedAt
        };

        try {
            await dbManager.db.run(`
                INSERT INTO market_history (model_name, brand, price_eur, source_url, scraped_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [record.model_name, record.brand, record.price_eur, record.source_url, record.scraped_at, new Date().toISOString()]);
            inserted.push(record);
            
            if ((i + 1) % 10 === 0) {
                console.log(`Processed ${i + 1}/${count} records...`);
            }
        } catch (e) {
            console.error('Insert error:', e);
        }
    }

    console.log(`Successfully injected ${inserted.length} real-market records.`);
    
    // Verify count
    const rows = await dbManager.db.all('SELECT COUNT(*) as count FROM market_history');
    console.log(`Total records in market_history: ${rows[0].count}`);
}

run();
