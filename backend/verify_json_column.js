const { db } = require('./src/js/mysql-config');

async function verifyData() {
    console.log('🔍 Verifying `data` column population...');
    const bikes = await db.query('SELECT id, brand, model, data FROM bikes LIMIT 3');
    
    for (const bike of bikes) {
        console.log(`\nBike #${bike.id}: ${bike.brand} ${bike.model}`);
        if (bike.data) {
            try {
                const parsed = JSON.parse(bike.data);
                console.log('   ✅ Data is valid JSON');
                console.log('   Specs:', parsed.specs ? Object.keys(parsed.specs) : 'Missing');
                console.log('   Inspection:', parsed.inspection ? Object.keys(parsed.inspection) : 'Missing');
            } catch (e) {
                console.log('   ❌ Data is NOT valid JSON:', e.message);
            }
        } else {
            console.log('   ❌ Data column is empty/null');
        }
    }
}

verifyData().catch(console.error);