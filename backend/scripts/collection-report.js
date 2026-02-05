const DatabaseManager = require('../database/db-manager');

class CollectionReport {
  constructor() {
    this.dbManager = new DatabaseManager();
  }

  async generate() {
    const db = this.dbManager.getDatabase();
    
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   📊 FINAL COLLECTION REPORT                        ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    // 1. Total Count
    const total = db.prepare('SELECT COUNT(*) as count FROM market_history').get().count;
    console.log(`Total Records: ${total}\n`);
    
    // 2. Categories
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM market_history 
      GROUP BY category 
      ORDER BY count DESC
    `).all();
    
    console.log('By Category:');
    categories.forEach(c => {
      console.log(`  ${c.category.padEnd(10)}: ${c.count}`);
    });
    console.log('');
    
    // 3. Top Brands
    const brands = db.prepare(`
      SELECT brand, COUNT(*) as count 
      FROM market_history 
      GROUP BY brand 
      ORDER BY count DESC 
      LIMIT 10
    `).all();
    
    console.log('Top 10 Brands:');
    brands.forEach(b => {
      console.log(`  ${b.brand.padEnd(15)}: ${b.count}`);
    });
    console.log('');
    
    // 4. Data Quality
    const quality = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN year IS NOT NULL THEN 1 ELSE 0 END) as with_year,
        SUM(CASE WHEN frame_size IS NOT NULL THEN 1 ELSE 0 END) as with_size,
        SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) as with_price
      FROM market_history
    `).get();
    
    console.log('Data Quality:');
    console.log(`  With Year:      ${quality.with_year} (${(quality.with_year/total*100).toFixed(1)}%)`);
    console.log(`  With Size:      ${quality.with_size} (${(quality.with_size/total*100).toFixed(1)}%)`);
    console.log(`  With Price:     ${quality.with_price} (${(quality.with_price/total*100).toFixed(1)}%)`);
    console.log('');
    
    // 5. Sample Data
    console.log('Sample Records (Last 5):');
    const samples = db.prepare(`
      SELECT brand, model, year, frame_size, price 
      FROM market_history 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    
    samples.forEach(s => {
      console.log(`  ${s.brand} ${s.model} | ${s.year || '-'} | ${s.frame_size || '-'} | €${s.price}`);
    });
  }
}

// Run report
if (require.main === module) {
  const report = new CollectionReport();
  report.generate();
}
