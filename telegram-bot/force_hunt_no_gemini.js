const UnifiedHunter = require('./unified-hunter');
const BikesDatabase = require('./bikes-database-node');

async function main() {
    console.log('🚀 Starting FORCE HUNT NO GEMINI...');
    
    const logger = (msg) => console.log(`[NO_AI_HUNTER] ${msg}`);
    const hunter = new UnifiedHunter({ logger });
    const bikesDB = new BikesDatabase();
    
    await hunter.ensureInitialized();
    await bikesDB.ensureInitialized();
    
    const targetQuery = 'canyon spectral';
    const targetUrl = `https://www.kleinanzeigen.de/s-fahrraeder/${targetQuery.replace(/\s+/g, '-')}/k0c217+fahrraeder.type_s:mountainbike`;
    
    try {
        const html = await hunter.fetchHtml(targetUrl);
        const items = hunter.parseSearchItems(html);
        if (items.length === 0) process.exit(1);
        
        const item = items[0];
        console.log(`👉 Processing: ${item.title}`);
        
        // Manual Process to bypass Gemini
        const rawData = await hunter.parser.parseKleinanzeigenLink(item.link);
        
        // Mock Final Data
        const finalData = {
            ...rawData,
            processedByGemini: false,
            conditionScore: 8,
            conditionGrade: 'B',
            conditionReason: 'Automated import (No AI)',
            confidence_score: 100,
            is_active: 1, // Force Active
            technical_score: 8,
            category: 'MTB', // Force valid category
            year: 2022 // Guess
        };
        
        // Save
        await bikesDB.addBike({
            name: finalData.title,
            brand: finalData.brand || 'Canyon',
            model: finalData.model || 'Spectral',
            price: Number(finalData.price),
            original_price: Number(finalData.price) * 1.2,
            discount: 20,
            category: 'MTB',
            year: 2022,
            condition: 'Used',
            is_active: 1,
            description: finalData.description,
            original_url: item.link,
            images: [], // Images will be empty initially, but link is there
            location: finalData.location,
            is_negotiable: 0,
            condition_class: 'B',
            hotness_score: 500,
            views_count: 100,
            publish_date: new Date().toISOString()
        });
        
        console.log('✅ Bike saved to DB (No AI).');
        process.exit(0);
        
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

main();
