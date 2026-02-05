require('ts-node').register();
const UnifiedHunter = require('../telegram-bot/unified-hunter');
const BikesDatabase = require('../telegram-bot/bikes-database-node');

async function massiveFill() {
    const hunter = new UnifiedHunter();
    const db = new BikesDatabase();
    
    // Top bike brands in DACH region
    const brands = [
        'Canyon', 'Specialized', 'Cube', 'Trek', 'Scott', 
        'Giant', 'Cannondale', 'Santa Cruz', 'YT Industries', 'Rose', 
        'Propain', 'Radon', 'Orbea', 'BMC', 'Merida', 'Ghost', 
        'Focus', 'Bianchi', 'Pinarello', 'Colnago', 'Cervelo',
        'Simplon', 'Stevens', 'Bergamont', 'KTM', 'Haibike',
        'Mondraker', 'Commencal', 'Nukeproof', 'Pivot', 'Yeti',
        'Norco', 'Rocky Mountain', 'Liteville', 'Rotwild', 'Nicolai',
        'Lapierre', 'Ridley', 'Wilier', 'Look', 'Ibis', 'Transition'
    ];
    
    console.log('🌊 Starting Massive Lake Refill (Target: 5000 items)...');
    
    const TARGET = 5000;
    const quotaPerBrand = Math.ceil(TARGET / brands.length); // ~200 per brand
    
    // Randomize brands order to mix it up
    const shuffledBrands = brands.sort(() => Math.random() - 0.5);

    for (const brand of shuffledBrands) {
        // Check total progress
        const currentCount = (await db.getQuery('SELECT COUNT(*) as c FROM market_history')).c;
        if (currentCount >= TARGET) {
            console.log(`🎉 Target reached! Total items: ${currentCount}`);
            break;
        }

        console.log(`\n👉 Targeting ${brand} (Quota: ${quotaPerBrand})...`);
        try {
            await hunter.fetchMarketData(quotaPerBrand, brand);
        } catch (e) {
            console.error(`Error processing ${brand}:`, e);
        }
        
        // Pause to respect rate limits
        await new Promise(r => setTimeout(r, 5000));
    }
    
    console.log('🏁 Massive Fill Cycle Complete.');
    process.exit(0);
}

massiveFill();
