
async function verifyApi() {
    console.log('🧪 VERIFYING API SORTING & FILTERS (Sprint 1.5)');
    const baseUrl = 'http://localhost:8082/api/bikes';
    
    try {
        // Test 1: Default Sort (Should be ranking_score DESC)
        console.log('\n1. Testing Default Sort (Expect Hot Deals at top)...');
        const res1 = await fetch(`${baseUrl}?limit=5`);
        const data1 = await res1.json();
        
        if (data1.bikes && data1.bikes.length > 0) {
            console.log(`   Fetched ${data1.bikes.length} bikes.`);
            data1.bikes.forEach((b, i) => {
                console.log(`   #${i+1} [${b.id}] ${b.basic_info.name} | Score: ${b.ranking.ranking_score} | Hot: ${b.ranking.is_hot_offer}`);
            });
            
            const topScore = data1.bikes[0].ranking.ranking_score;
            if (topScore >= 0.85) console.log('   ✅ Top bike has high ranking score!');
            else console.log('   ⚠️ Top bike score is low. Maybe re-indexing needed or sort failed.');
        } else {
            console.log('   ❌ No bikes returned.');
        }

        // Test 2: Hot Filter
        console.log('\n2. Testing Hot Filter (?hot=true)...');
        const res2 = await fetch(`${baseUrl}?hot=true&limit=5`);
        const data2 = await res2.json();
        
        if (data2.bikes && data2.bikes.length > 0) {
            const allHot = data2.bikes.every(b => b.ranking.is_hot_offer === true);
            if (allHot) console.log('   ✅ All returned bikes are Hot Offers.');
            else console.log('   ❌ Some bikes are NOT hot offers.');
        } else {
            console.log('   ⚠️ No hot deals found via API (maybe none exist yet).');
        }

    } catch (e) {
        console.error('❌ API Verification Failed:', e.message);
    }
}

verifyApi();
