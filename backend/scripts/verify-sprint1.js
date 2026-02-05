const HotDealHunter = require('../src/services/HotDealHunter');
const { DatabaseManager } = require('../src/js/mysql-config');

async function verifySprint1() {
    console.log('🧪 VERIFICATION SPRINT 1: HOT DEAL HUNTER');
    console.log('═'.repeat(60));

    // 1. Run the Hunter directly
    console.log('\n1. Executing HotDealHunter...');
    const stats = await HotDealHunter.hunt(2); // Try to get 2 bikes

    if (stats.added > 0) {
        console.log(`\n✅ Successfully added ${stats.added} hot deals.`);
        
        // 2. Verify DB entries
        const db = new DatabaseManager();
        const bikes = await db.query(`
            SELECT id, name, is_hot_offer, ranking_score, source_url 
            FROM bikes 
            WHERE is_hot_offer = 1 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [stats.added]);

        console.log('\n2. Verifying Database Entries:');
        bikes.forEach(b => {
            console.log(`   🚲 [${b.id}] ${b.name}`);
            console.log(`      is_hot_offer: ${b.is_hot_offer} (Expected: 1)`);
            console.log(`      ranking_score: ${b.ranking_score} (Expected: 0.85)`);
            
            if (b.is_hot_offer === 1 && b.ranking_score === 0.85) {
                console.log('      ✅ FLAGS CORRECT');
            } else {
                console.log('      ❌ FLAGS MISMATCH');
            }
        });

    } else {
        console.log('\n⚠️ No hot deals added (maybe already exist or none found). Check logs above.');
    }

    console.log('\n🏁 Verification Complete');
    process.exit(0);
}

verifySprint1().catch(console.error);
