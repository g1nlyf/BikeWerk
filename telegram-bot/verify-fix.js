require('dotenv').config();
const UnifiedHunter = require('./unified-hunter');
const BikesDatabaseNode = require('./bikes-database-node');

async function run() {
    console.log('🚀 Verifying fixes...');
    const hunter = new UnifiedHunter((msg) => console.log(msg));
    await hunter.ensureInitialized();
    const db = new BikesDatabaseNode();

    const url = 'https://www.kleinanzeigen.de/s-anzeige/cube-rennrad-attain-sl-shimano-105-rahmengroesse-60/3118002799-217-1371';
    
    console.log('1️⃣ Processing first time (Insert)...');
    try {
        await hunter.processListing(url);
    } catch (e) {
        console.error('Error run 1:', e);
    }
    
    console.log('\n2️⃣ Processing second time (Update check)...');
    try {
        await hunter.processListing(url);
    } catch (e) {
        console.error('Error run 2:', e);
    }

    // Check DB
    const bike = await db.getBikeByOriginalUrl(url);
    console.log('\n📊 Final DB Record:');
    if (bike) {
        console.log(`ID: ${bike.id}`);
        console.log(`Title: ${bike.name}`);
        console.log(`Seller: ${bike.seller_name} (${bike.seller_type})`);
        console.log(`Negotiable: ${bike.is_negotiable}`);
        console.log(`Condition Reason: ${bike.condition_reason}`);
        console.log(`Structured Data Used: ${bike.source.includes('structure') || 'Implicit in processing'}`);
    } else {
        console.log('❌ Bike not found in DB!');
    }
    
    console.log('\n✅ Done.');
    process.exit(0);
}

run();
