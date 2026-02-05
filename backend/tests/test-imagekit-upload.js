require('dotenv').config();
const path = require('path');
const fs = require('fs');
const imageKitService = require('../src/services/ImageKitService');

async function testUpload() {
    console.log('\n🧪 Testing ImageKit upload...');
    
    // Create a dummy buffer (1x1 pixel PNG)
    // Base64 of a 1x1 red pixel
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(base64, 'base64');
    
    try {
        // 1. Upload
        console.log('📤 Uploading test image...');
        const result = await imageKitService.uploadImage(
            buffer, 
            'test_pixel.png', 
            '/test_folder'
        );
        
        console.log('\n✅ Upload successful!');
        console.log('URL:', result.url);
        console.log('File ID:', result.fileId);
        console.log('Size:', result.size, 'bytes');
        
        // 2. Transform URL
        console.log('\n🔄 Generating transformed URL...');
        const transformed = imageKitService.generateTransformedUrl(result.url, {
            width: 100,
            height: 100,
            quality: 80
        });
        console.log('Transformed:', transformed);
        
        // 3. Delete (Cleanup)
        console.log('\n🗑️ Cleaning up...');
        await imageKitService.deleteImage(result.fileId);
        console.log('✅ Test cleanup complete');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

testUpload();
