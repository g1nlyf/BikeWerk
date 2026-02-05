const axios = require('axios');

async function checkUrl(label, url) {
  try {
    const start = Date.now();
    const res = await axios.head(url);
    const duration = Date.now() - start;
    const size = res.headers['content-length'];
    const type = res.headers['content-type'];
    
    console.log(`✅ ${label}:`);
    console.log(`   URL: ${url}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
    console.log(`   Type: ${type}`);
    console.log(`   Time: ${duration}ms`);
    return { size: Number(size), type };
  } catch (e) {
    console.log(`❌ ${label} Failed: ${e.message}`);
    if (e.response) {
        console.log(`   Status: ${e.response.status}`);
    }
    return null;
  }
}

async function run() {
  // Using bike 5 from previous fix, or 112
  const baseUrl = 'https://ik.imagekit.io/bikewerk/bikes/id5/0.webp';
  
  console.log('🚀 Testing ImageKit Transformations...\n');

  const original = await checkUrl('Original', baseUrl);
  const thumb = await checkUrl('Thumbnail (400px)', `${baseUrl}?tr=w-400,h-300,q-80,f-auto`);
  const mobile = await checkUrl('Mobile (200px)', `${baseUrl}?tr=w-200,h-150,q-70,f-auto`);
  const full = await checkUrl('Full (1200px)', `${baseUrl}?tr=w-1200,q-90,f-auto`);

  if (original && thumb && mobile) {
      console.log('\n📊 Size Comparison:');
      console.log(`   Original: ${(original.size / 1024).toFixed(2)} KB`);
      console.log(`   Thumb:    ${(thumb.size / 1024).toFixed(2)} KB`);
      console.log(`   Mobile:   ${(mobile.size / 1024).toFixed(2)} KB`);
      
      if (thumb.size < original.size && mobile.size < thumb.size) {
          console.log('\n✅ Transformations are working correctly (sizes are reducing).');
      } else {
          console.log('\n⚠️ Transformations might not be effective (sizes are similar).');
      }
  }
}

run();
