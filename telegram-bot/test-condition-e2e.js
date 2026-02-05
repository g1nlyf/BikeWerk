require('dotenv').config({ path: '../backend/.env' });
const AutonomousOrchestrator = require('./AutonomousOrchestrator');
const KleinanzeigenParser = require('./kleinanzeigen-parser');
const BikesDatabase = require('./bikes-database-node');

async function run() {
    console.log('🚀 Starting E2E Condition Assessment Test...');
    
    // Initialize components
    const orchestrator = new AutonomousOrchestrator();
    // Force wait for initialization if needed (usually synchronous constructors)
    
    const parser = new KleinanzeigenParser();
    const db = new BikesDatabase();
    await db.ensureInitialized();

    const url = 'https://www.kleinanzeigen.de/s-anzeige/canyon-strive-mountain-bike-fully/3284060830-217-9290';
    console.log(`\n🕵️ Deep Analyzing URL: ${url}`);

    try {
        // A. Deep Scrape
        console.log('1️⃣ Parsing Kleinanzeigen...');
        const parsedData = await parser.parseKleinanzeigenLink(url);
        
        if (!parsedData) {
            console.error('❌ Parse failed. Check URL or parser logic.');
            return;
        }
        console.log(`   ✅ Parsed: ${parsedData.title} (${parsedData.price} EUR)`);

        // B. AI Enrichment
        console.log('\n2️⃣ AI Enrichment (Cognitive Inspector)...');
        
        // Construct rawData similar to Orchestrator flow
        const rawData = {
            ...parsedData,
            price: parsedData.price || 0,
            originalUrl: url
        };

        const enrichedData = await orchestrator.gemini.enrichBikeData(rawData);
        
        console.log('\n🧠 AI Verdict Received:');
        console.log(`   - Class: ${enrichedData.class}`);
        console.log(`   - Score: ${enrichedData.technical_score}/10`);
        console.log(`   - Justification: "${enrichedData.justification}"`);
        console.log(`   - Confidence: ${enrichedData.confidence}`);
        
        if (enrichedData.seller_questions) {
            console.log(`   - Seller Questions: ${JSON.stringify(enrichedData.seller_questions)}`);
        }

        // C. Map & Save
        console.log('\n3️⃣ Saving to Database...');
        // Mock candidate object required by _mapToDbSchema
        const candidate = {
            title: parsedData.title,
            fmv: 0, // Mock FMV
            source_url: url
        };
        
        const dbBike = orchestrator._mapToDbSchema(enrichedData, candidate);
        const result = await db.addBike(dbBike);
        console.log(`   ✅ Saved Bike ID: ${result.id}`);

        // D. Verify DB Record
        console.log('\n4️⃣ Verifying Database Record...');
        const savedBike = await db.getBikeById(result.id);
        
        console.log('   🔍 DB Row Data:');
        console.log(`      - id: ${savedBike.id}`);
        console.log(`      - initial_quality_class: ${savedBike.initial_quality_class}`);
        console.log(`      - condition_score: ${savedBike.condition_score}`);
        console.log(`      - condition_reason: "${savedBike.condition_reason}"`);
        console.log(`      - condition_report (JSON length): ${savedBike.condition_report ? savedBike.condition_report.length : 'NULL'}`);
        
        console.log('\n✨ E2E Test Completed Successfully!');
        console.log('   Check Frontend at: http://localhost:3000/product/' + result.id);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

run();
