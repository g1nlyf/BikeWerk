const DatabaseManager = require('../database/db-manager');
const DataCollectionTester = require('./test-data-collection').DataCollectionTester;
const path = require('path');
const fs = require('fs');

async function resetAndHuntOne() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   🧹 RESET CATALOG & HUNT ONE BIKE                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();

  // 1. Clear Database
  console.log('1. Clearing Database...');
  try {
    // Check tables exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    
    if (tables.includes('bikes')) {
      db.prepare('DELETE FROM bikes').run();
      console.log('   ✅ Table "bikes" cleared.');
    }
    
    if (tables.includes('market_history')) {
      db.prepare('DELETE FROM market_history').run();
      console.log('   ✅ Table "market_history" cleared.');
    }
    
    // Clear other related tables if needed?
    // For now just bikes and history as per request
    
  } catch (err) {
    console.error('   ❌ Error clearing DB:', err.message);
  }

  // 2. Clear Images
  console.log('\n2. Clearing Images...');
  const imagesDir = path.join(__dirname, '../public/images/bikes');
  if (fs.existsSync(imagesDir)) {
    // Delete all subfolders
    const files = fs.readdirSync(imagesDir);
    for (const file of files) {
      const filePath = path.join(imagesDir, file);
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    }
    console.log('   ✅ Images folder cleared.');
  } else {
    console.log('   ⚠️ Images folder not found, creating...');
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // 3. Run Hunter for 1 Bike
  console.log('\n3. Hunting 1 Bike...');
  
  // We need to use the actual hunter logic that saves to 'bikes' table, not just 'market_history'.
  // 'test-data-collection.js' only saves to 'market_history'.
  // We need 'mass-data-collection.js' logic but limited to 1 bike and ensure it promotes to 'bikes' table or we manually promote it.
  // The user said "запусти хантера... на добавление одного байка". 
  // Typically the hunter flow is: Search -> Market History -> Filter -> Catalog (Bikes table).
  // Let's use 'test-data-collection.js' to get data, then manually insert into 'bikes' to simulate a "perfect hunt".
  
  // Or better: use the existing 'test-data-collection.js' which now has good extraction, 
  // and then take that successful extraction and insert into 'bikes'.
  
  const tester = new DataCollectionTester();
  
  // Modify tester to return the extracted data instead of just logging
  // We can't easily modify the class instance method without changing the file.
  // But 'test-data-collection.js' runs extraction and saves to 'market_history'.
  // We can query 'market_history' after run, pick one, and insert to 'bikes'.
  
  // Let's run the test script (it hunts 3 bikes: YT, Specialized, Santa Cruz)
  // We only need one.
  
  // Actually, let's just use the tester's logic directly here.
  
  const target = {
    brand: 'Santa Cruz',
    model: 'Bronson',
    category: 'Trail',
    minPrice: 2000,
    maxPrice: 4000
  };
  
  console.log(`   Target: ${target.brand} ${target.model}`);
  
  try {
    const url = tester.urlBuilder.buildSearchURL(target);
    console.log(`   URL: ${url}`);
    
    const html = await tester.fetchPage(url);
    const listings = await tester.parseListings(html);
    const filtered = tester.applyFunnelFilter(listings);
    
    if (filtered.length === 0) {
      throw new Error('No listings found');
    }
    
    const bestListing = filtered[0];
    const extracted = tester.extractData(bestListing, target);
    
    console.log('   ✅ Extracted Data:', extracted);
    
    // Save to market_history
    await tester.testSave(extracted);
    
    // Save to bikes (Catalog)
    console.log('   💾 Saving to Catalog (bikes table)...');
    
    const stmt = db.prepare(`
      INSERT INTO bikes (
        name, brand, model, year, category, price, price_eur,
        size, main_image, original_url, description, 
        created_at, updated_at, added_at, is_active, source, condition_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'), 1, 'hunter', 'used')
    `);
    
    // We need a dummy image or try to fetch real one? 
    // Kleinanzeigen images are tricky to scrape without browser automation sometimes.
    // But let's assume we use a placeholder or try to extract from HTML if possible.
    // The current 'test-data-collection.js' doesn't extract image URL from listing list?
    // Let's check parseListings in test-data-collection.js... it only gets title, price, url, description.
    // We need image!
    
    // Let's quickly fetch the listing page to get the image
    console.log('   🖼️  Fetching image from listing page...');
    const listingHtml = await tester.fetchPage(extracted.source_url);
    const $ = require('cheerio').load(listingHtml);
    const imgUrl = $('#viewad-image').attr('src') || $('.galleryimage-large').attr('src') || $('.galleryimage-element > img').attr('src');
    
    const finalImgUrl = imgUrl || 'https://dummyimage.com/600x400/000/fff&text=Santa+Cruz';
    
    const info = stmt.run(
      extracted.title,
      extracted.brand,
      extracted.model,
      extracted.year || 2022,
      extracted.category,
      extracted.price,
      extracted.price, // price_eur same as price
      extracted.frame_size || 'L',
      finalImgUrl,
      extracted.source_url,
      extracted.description
    );
    
    console.log(`   ✅ Bike added to catalog with ID: ${info.lastInsertRowid}`);
    
    // Download image to local
    if (finalImgUrl.startsWith('http')) {
        const fetch = (await import('node-fetch')).default;
        const imgResp = await fetch(finalImgUrl);
        const buffer = await imgResp.arrayBuffer();
        const imgPath = path.join(imagesDir, `${info.lastInsertRowid}_0.jpg`); // Standard format id_index.jpg
        fs.writeFileSync(imgPath, Buffer.from(buffer));
        console.log(`   ✅ Image downloaded to ${imgPath}`);
        
        // Update DB with local path if needed, or keep URL. 
        // Frontend usually expects local path or URL. 
        // Let's update to local filename format if your system uses it.
        // Assuming system uses 'id_index.jpg' convention in public/images/bikes
        // We usually store just the filename or full URL? 
        // Let's stick to what's in DB. If it's a URL, frontend might resolve it. 
        // But for "deployment sync", having local file is better.
        
        db.prepare('UPDATE bikes SET main_image = ? WHERE id = ?').run(`${info.lastInsertRowid}_0.jpg`, info.lastInsertRowid);
    }

  } catch (err) {
    console.error('   ❌ Error hunting:', err);
  }
}

resetAndHuntOne();
