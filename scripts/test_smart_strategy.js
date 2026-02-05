const SmartTargetStrategy = require('../backend/services/smart-target-strategy');

async function main() {
    console.log('🧪 Testing SmartTargetStrategy...');
    const strategy = new SmartTargetStrategy();
    
    const targets = await strategy.generateTargets(20); // Generate 20 targets
    
    console.log(`✅ Generated ${targets.length} targets.`);
    
    targets.forEach((t, i) => {
        console.log(`   ${i+1}. [${t.tier.toUpperCase()}] ${t.brand} ${t.model} (${t.minPrice}-${t.maxPrice}€) - Priority: ${t.priority}`);
    });
    
    // Check distribution
    const tiers = targets.reduce((acc, t) => {
        acc[t.tier] = (acc[t.tier] || 0) + 1;
        return acc;
    }, {});
    
    console.log('\n📊 Distribution Result:', tiers);
}

main().catch(console.error);
