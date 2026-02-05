const DeepCatalogBuilder = require('../src/services/deep-catalog-builder');

async function test() {
    console.log('🧪 Testing Deep Catalog Builder...');
    
    // Test with a known model
    const brand = 'Santa Cruz';
    const model = 'Nomad';
    
    console.log(`\nTesting buildDeepCatalogForModel(${brand}, ${model})...`);
    
    try {
        const catalog = await DeepCatalogBuilder.buildDeepCatalogForModel(brand, model);
        
        console.log(`\n✅ Catalog built with ${catalog.length} items.`);
        
        // Log distribution
        const bySource = {};
        catalog.forEach(i => {
            bySource[i.source] = (bySource[i.source] || 0) + 1;
        });
        console.log('Distribution:', bySource);
        
    } catch (e) {
        console.error('❌ Test failed:', e);
    }
    
    process.exit(0);
}

test();
