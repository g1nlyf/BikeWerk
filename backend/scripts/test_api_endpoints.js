const http = require('http');

function fetch(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:8082${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function runTests() {
    console.log('🧪 TEST 2: API ENDPOINTS VERIFICATION');
    
    try {
        // Test 1: Catalog API
        console.log('\n1. Catalog API (/api/catalog/bikes?limit=3)');
        const catalog = await fetch('/api/catalog/bikes?limit=3');
        if (catalog.bikes && catalog.bikes.length > 0) {
            console.log(`✅ Returned ${catalog.bikes.length} bikes`);
            catalog.bikes.forEach(b => {
                console.log(`   ID ${b.id}: main_image=${b.main_image}`);
                if (b.main_image && (b.main_image.includes('ik.imagekit.io') || b.main_image.startsWith('http'))) {
                    console.log('   ✅ Valid Remote URL');
                } else {
                    console.log('   ❌ INVALID URL (Local or Missing)');
                }
            });
        } else {
            console.log('❌ Catalog empty or error');
        }

        // Test 2: Single Bike
        console.log('\n2. Single Bike API (/api/bikes/75)');
        const bike = await fetch('/api/bikes/75');
        if (bike.id) {
            console.log(`   ID ${bike.id}: main_image=${bike.main_image}`);
             if (bike.main_image && (bike.main_image.includes('ik.imagekit.io') || bike.main_image.startsWith('http'))) {
                console.log('   ✅ Valid Remote URL');
            } else {
                console.log('   ❌ INVALID URL');
            }
        } else {
            console.log('❌ Bike 75 not found');
        }

        // Test 3: Gallery
        console.log('\n3. Gallery Data (/api/bikes/75)');
        if (bike.images && Array.isArray(bike.images)) {
            console.log(`   Found ${bike.images.length} images`);
            bike.images.slice(0, 3).forEach(img => {
                console.log(`   - ${img.image_url || img.local_path}`);
            });
            const allRemote = bike.images.every(img => (img.image_url && img.image_url.startsWith('http')) || (img.local_path && img.local_path.startsWith('http')));
            if (allRemote) console.log('   ✅ All images are remote URLs');
            else console.log('   ⚠️ Some images might be local');
        } else {
            console.log('❌ No images array found');
        }

    } catch (e) {
        console.error('❌ API Error:', e.message);
        console.log('Make sure server is running on port 8082');
    }
}

runTests();
