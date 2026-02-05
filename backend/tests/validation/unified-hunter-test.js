const fs = require('fs');
const path = require('path');
const GeminiProcessor = require('../../src/services/geminiProcessor');
const BuycycleCollector = require('../../scrapers/buycycle-collector');
const DatabaseManager = require('../../database/db-manager');

async function runTest() {
    console.log('🚀 Starting Unified Hunter Test Run...');
    
    // 1. Setup
    const testResultsDir = path.join(__dirname, '../../test-results');
    if (!fs.existsSync(testResultsDir)) fs.mkdirSync(testResultsDir, { recursive: true });
    
    const db = new DatabaseManager();
    // await db.initialize(); // Not needed for better-sqlite3 manager

    // 3. Mock or Real Collection
    console.log('\n--- TEST 1: Buycycle ---');
    const buycycleMock = {
        source_platform: 'buycycle',
        source_url: 'https://buycycle.com/de-de/product/specialized-status-160-2022-90020',
        title: 'Specialized Status 160 2022',
        price: 1300,
        currency: 'EUR',
        year: 2022,
        description: 'Specialized Status 160 in sehr gutem Zustand. Wenig gefahren. SRAM GX Eagle 12-fach, RockShox Yari RC, RockShox Super Deluxe Select+. Rahmen hat kleine Kratzer.',
        location: 'Berlin',
        components: {
            frame: 'Aluminum',
            fork: 'RockShox Yari RC 160mm',
            shock: 'RockShox Super Deluxe Select+',
            groupset: 'SRAM GX Eagle',
            brakes: 'SRAM Code R',
            wheels: 'Roval Traverse'
        },
        general_info: {
            condition: 'very_good',
            size: 'S3'
        },
        images: [
            'https://example.com/img1.jpg',
            'https://example.com/img2.jpg'
        ]
    };

    try {
        console.log(`📡 Simulating Buycycle data collection...`);
        const unifiedData = await GeminiProcessor.analyzeBikeToUnifiedFormat(buycycleMock);
        
        console.log('\n✅ Buycycle Result:');
        console.log(`   Name: ${unifiedData.basic_info?.name}`);
        console.log(`   Price: ${unifiedData.pricing?.price} ${unifiedData.pricing?.currency}`);
        console.log(`   Condition Score: ${unifiedData.condition?.score}`);
        console.log(`   Description (RU): ${unifiedData.basic_info?.description?.substring(0, 50)}...`);
    } catch (e) {
        console.error('❌ Buycycle processing failed:', e.message);
    }

    console.log('\n--- TEST 2: Kleinanzeigen ---');
    const kleinanzeigenMock = {
        source_platform: 'kleinanzeigen',
        source_url: 'https://www.kleinanzeigen.de/s-anzeige/canyon-spectral-cf-7-l/123456789',
        title: 'Canyon Spectral CF 7 Gr. L Carbon',
        price: 2100,
        currency: 'EUR',
        description: 'Verkaufe mein Canyon Spectral CF 7 aus 2021. Rahmengröße L. Carbon Rahmen. Das Rad wurde artgerecht bewegt, hat aber keine Risse. Übliche Gebrauchsspuren vorhanden. Dämpfer und Gabel frisch vom Service. Shimano XT Ausstattung. Nur Abholung in München.',
        location: 'Berlin',
        general_info: {
            'Art': 'Mountainbike',
            'Typ': 'Enduro'
        },
        images: [
            'https://example.com/ka_img1.jpg'
        ]
    };

    try {
        console.log(`📡 Simulating Kleinanzeigen data collection...`);
        const unifiedDataKA = await GeminiProcessor.analyzeBikeToUnifiedFormat(kleinanzeigenMock, 3, 'kleinanzeigen');
        
        console.log('\n✅ Kleinanzeigen Result:');
        console.log(`   Name: ${unifiedDataKA.basic_info?.name}`);
        console.log(`   Price: ${unifiedDataKA.pricing?.price} ${unifiedDataKA.pricing?.currency}`);
        console.log(`   Condition Score: ${unifiedDataKA.condition?.score}`);
        console.log(`   Description (RU): ${unifiedDataKA.basic_info?.description?.substring(0, 50)}...`);
    } catch (e) {
        console.error('❌ Kleinanzeigen processing failed:', e.message);
    }
}

runTest().catch(console.error);
