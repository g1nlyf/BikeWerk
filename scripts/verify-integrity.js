const axios = require('axios');
const { DatabaseManager } = require('../backend/src/js/mysql-config');

async function verifyIntegrity() {
    console.log('🔍 Starting Integrity Check...');
    
    // 1. Check DB directly
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    const bikes = await dbManager.db.all('SELECT id, brand, model, price FROM bikes ORDER BY id DESC LIMIT 5');
    console.log(`\n📊 DB Check (Direct): Found ${bikes.length} bikes.`);
    bikes.forEach(b => console.log(`   - ID ${b.id}: ${b.brand} ${b.model} (${b.price}€)`));
    
    const mhCount = await dbManager.db.get('SELECT COUNT(*) as count FROM market_history');
    console.log(`\n📊 Market History: ${mhCount.count} raw items collected.`);

    // 2. Check API
    // Ensure server is running or try to fetch if port is open
    try {
        console.log('\n🌐 Checking API (http://localhost:8081/api/bikes)...');
        const res = await axios.get('http://localhost:8081/api/bikes', { timeout: 2000 });
        if (res.data && Array.isArray(res.data)) {
            console.log(`✅ API Response: ${res.data.length} bikes returned.`);
            if (res.data.length > 0) {
                console.log(`   - Sample: ${res.data[0].name} (ID: ${res.data[0].id})`);
            }
        } else {
            console.warn('⚠️ API returned unexpected format:', typeof res.data);
        }
    } catch (e) {
        console.warn(`⚠️ API Check Failed (Server might be down or restarting): ${e.message}`);
        console.log('   (This is expected if you haven\'t restarted the backend server after DB wipe)');
    }
    
    // 3. Output Link for User
    if (bikes.length > 0) {
        console.log(`\n🎉 First Added Bike: ID ${bikes[bikes.length-1].id}`);
        console.log(`👉 Link: http://localhost:5173/catalog/${bikes[bikes.length-1].id}`);
    } else {
        console.log('\n❌ No bikes found in catalog.');
    }
}

verifyIntegrity();
