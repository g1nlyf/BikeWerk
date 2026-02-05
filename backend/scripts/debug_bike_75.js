const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

const bikeId = 75;

console.log(`--- Inspecting Bike ID ${bikeId} ---`);

const bike = db.prepare('SELECT * FROM bikes WHERE id = ?').get(bikeId);

if (!bike) {
    console.log('Bike not found!');
} else {
    console.log('Basic Info:');
    console.log(`Name: ${bike.name}`);
    console.log(`Source URL: ${bike.source_url}`);
    console.log(`Price: ${bike.price}`);
    console.log(`Condition Grade: ${bike.condition_grade}`);
    console.log(`Condition Status: ${bike.condition_status}`);
    
    console.log('\n--- Gallery (Raw) ---');
    console.log(bike.gallery);
    
    console.log('\n--- Images (Main) ---');
    console.log(bike.main_image);

    console.log('\n--- Unified Data (Snippet) ---');
    if (bike.unified_data) {
        try {
            const ud = JSON.parse(bike.unified_data);
            console.log(JSON.stringify(ud, null, 2).slice(0, 500) + '...');
            console.log('\nUnified Media Gallery:', JSON.stringify(ud.media?.gallery, null, 2));
            console.log('Unified Condition:', JSON.stringify(ud.condition, null, 2));
            console.log('Unified Specs:', JSON.stringify(ud.specs, null, 2));
        } catch (e) {
            console.log('Error parsing unified_data:', e.message);
            console.log('Raw unified_data:', bike.unified_data);
        }
    } else {
        console.log('No unified_data found.');
    }

    console.log('\n--- Features JSON ---');
    console.log(bike.features_json);
}
