require('dotenv').config();
const PhotoManager = require('../src/services/PhotoManager');
const imageKitService = require('../src/services/ImageKitService');

async function testPipeline() {
    console.log('\n🧪 Testing Photo Pipeline with ImageKit...');
    
    // Fake bike ID
    const bikeId = 999999;
    
    // Test URLs (using reliable placeholder images or real bike images if available)
    const photoUrls = [
        'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800', // Cyclist
        'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800', // Bike parts
        'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800'  // Mountain bike
    ];

    const photoManager = new PhotoManager();
    
    try {
        console.log(`\nDownloading ${photoUrls.length} photos for bike ${bikeId}...`);
        
        const results = await photoManager.downloadAndSave(bikeId, photoUrls);
        
        let successCount = 0;
        const uploadedFileIds = [];
        
        results.forEach((res, i) => {
            if (res.is_downloaded && res.local_path && res.local_path.startsWith('https://ik.imagekit.io')) {
                console.log(`[${i+1}/${photoUrls.length}] ✅ ${res.local_path}`);
                successCount++;
                if (res.file_id) uploadedFileIds.push(res.file_id);
            } else {
                console.log(`[${i+1}/${photoUrls.length}] ❌ Failed: ${res.error || 'Unknown error'}`);
            }
        });
        
        if (successCount === photoUrls.length) {
            console.log('\n✅ All photos uploaded to ImageKit');
            console.log('✅ URLs validated (format check)');
        } else {
            console.warn(`\n⚠️ Partial success: ${successCount}/${photoUrls.length}`);
        }
        
        // Cleanup
        console.log('\n🧹 Cleaning up test files...');
        for (const fileId of uploadedFileIds) {
            await imageKitService.deleteImage(fileId);
        }
        console.log('✅ Test complete');
        
    } catch (error) {
        console.error('\n❌ Pipeline test failed:', error);
        process.exit(1);
    }
}

testPipeline();
