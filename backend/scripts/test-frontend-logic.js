const fetch = require('node-fetch');

// Simulate resolveImageUrl from frontend
function resolveImageUrl(path) {
    if (path == null) return null;
    if (typeof path !== 'string') {
        if (Array.isArray(path)) {
            path = path.length ? path[0] : null;
        } else if (typeof path === 'object') {
            path = path.image_url || path.url || path.src || null;
        } else {
            path = String(path);
        }
    }
    const p = (path || '').trim();
    if (!p || p.includes('[object Promise]')) return null;
    
    // ImageKit URL - return as is
    if (p.includes('ik.imagekit.io')) {
        return p;
    }
    
    // External URLs
    if (/^https?:\/\//i.test(p)) {
        return p;
    }
    
    // Local paths
    return `/api${p.startsWith('/') ? p : '/' + p}`;
}

async function testBikeCard(bikeId) {
    console.log(`\n=== Testing Bike ${bikeId} ===`);
    
    // Step 1: Get catalog data (simulates what CatalogPage does)
    const catalogResp = await fetch(`http://localhost:8082/api/catalog/bikes?limit=10`);
    const catalogData = await catalogResp.json();
    const bike = catalogData.bikes.find(b => b.id === bikeId);
    
    if (!bike) {
        console.log(`Bike ${bikeId} not found in catalog`);
        return;
    }
    
    // Step 2: Create bike.image (simulates CatalogPage createBike)
    const createImage = () => {
        const main = bike['main_image'];
        if (typeof main === 'string' && main) return main;
        const imgs = bike['images'];
        if (Array.isArray(imgs)) {
            const first = imgs[0];
            if (typeof first === 'string') return first;
            const url = first?.['image_url'];
            if (typeof url === 'string') return url;
        }
        return '';
    };
    
    const bikeImage = createImage();
    console.log('1. bike.image from CatalogPage:', bikeImage ? bikeImage.substring(0, 60) + '...' : 'EMPTY');
    
    // Step 3: Initial images state (simulates BikeCard useState)
    const initialImages = (bikeImage ? [resolveImageUrl(bikeImage)] : []).filter(x => !!x);
    console.log('2. Initial images state:', initialImages.length > 0 ? `[${initialImages[0].substring(0, 50)}...]` : 'EMPTY []');
    
    // Step 4: Fetch /bike-images (simulates BikeCard useEffect)
    const imagesResp = await fetch(`http://localhost:8082/api/bike-images?bikeId=${bikeId}`);
    const imagesData = await imagesResp.json();
    console.log('3. /bike-images response:', {
        success: imagesData.success,
        imagesCount: imagesData.images?.length || 0,
        firstImage: imagesData.images?.[0]
    });
    
    // Step 5: Process response (simulates BikeCard then callback)
    const arr = Array.isArray(imagesData?.images)
        ? imagesData.images.map(x => resolveImageUrl(x.image_url)).filter(x => !!x)
        : [];
    console.log('4. Processed images array:', arr.length > 0 ? `${arr.length} images, first: ${arr[0].substring(0, 50)}...` : 'EMPTY []');
    
    // Step 6: Final state
    const finalImages = arr.length > 0 ? arr : initialImages;
    const imageSrc = finalImages[0] || '';
    console.log('5. Final imageSrc:', imageSrc ? imageSrc.substring(0, 60) + '...' : 'EMPTY - Will show "Нет фото"');
    
    // Verdict
    if (!imageSrc) {
        console.log('\n❌ PROBLEM: imageSrc is empty, UI will show "Нет фото"');
    } else {
        // Verify URL works
        try {
            const imgResp = await fetch(imageSrc, { method: 'HEAD' });
            if (imgResp.status === 200) {
                console.log('\n✓ OK: Image URL is valid and returns 200');
            } else {
                console.log(`\n❌ PROBLEM: Image URL returns ${imgResp.status}`);
            }
        } catch (e) {
            console.log(`\n❌ PROBLEM: Cannot fetch image URL: ${e.message}`);
        }
    }
}

async function main() {
    for (const id of [3, 4, 5]) {
        await testBikeCard(id);
    }
}

main().catch(console.error);
