const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

class AvailabilityChecker {
  
  async checkBikeAvailability(bike) {
    console.log(`🔍 Checking: ${bike.brand} ${bike.model} [${bike.source}]`);
    
    if (!bike.source_url) {
        console.log('   ⚠️ No source URL, skipping.');
        return 'unknown';
    }

    try {
      const browser = await puppeteer.launch({ 
          headless: "new",
          args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });
      
      const response = await page.goto(bike.source_url, { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });
      
      // Check HTTP Status
      if (response.status() === 404 || response.status() === 410) {
          await browser.close();
          return 'deleted';
      }

      // Content Check
      const status = await page.evaluate((source) => {
        const body = document.body.textContent.toLowerCase();
        
        // Kleinanzeigen indicators
        if (source === 'kleinanzeigen') {
          if (body.includes('anzeige wurde gelöscht') || 
              body.includes('leider nicht gefunden') ||
              body.includes('diese anzeige ist nicht mehr verfügbar')) {
            return 'deleted';
          }
          if (body.includes('anzeige ist deaktiviert') || body.includes('reserviert')) {
            return 'sold'; // Reserved is effectively sold for us
          }
        }
        
        // Buycycle indicators
        if (source === 'buycycle') {
          if (body.includes('sold') || body.includes('verkauft')) {
            return 'sold';
          }
          if (body.includes('page not found') || body.includes('404')) {
            return 'deleted';
          }
        }
        
        // Bikeflip indicators
        if (source === 'bikeflip') {
             if (body.includes('sold') || body.includes('verkauft')) {
                 return 'sold';
             }
        }
        
        return 'available';
      }, bike.source || 'kleinanzeigen'); // Default to KA
      
      await browser.close();
      
      return status;
      
    } catch (error) {
      console.error(`❌ Check failed: ${error.message}`);
      return 'unknown'; // Don't delete if unsure
    }
  }
  
  async runDailyFreshnessCheck() {
    console.log('🧹 Starting Daily Freshness Check\n');
    
    // Get queue from SmartScheduler if available, or fallback
    // For now, simple logic as per Task 5.1, but we will integrate 5.2 logic later
    // Let's query basic active bikes
    
    const activeBikes = await db.query(`
      SELECT * FROM bikes
      WHERE is_active = 1
      ORDER BY last_checked ASC
      LIMIT 20 -- Conservative batch for testing
    `);
    
    if (!activeBikes || activeBikes.length === 0) {
        console.log('✅ No active bikes to check.');
        return { removed: 0, stillAvailable: 0 };
    }
    
    let removed = 0;
    let stillAvailable = 0;
    
    for (const bike of activeBikes) {
      // Find source URL from market_history or bike table
      // We added source_url to bikes in Sprint 2.1 (schema update needed if not)
      // Let's assume we can join or it's on bike object.
      // If not on bike, try to fetch from market_history using external_id or similar.
      
      let targetBike = bike;
      if (!bike.source_url) {
          // Try to find url
          const history = await db.query(`SELECT source_url, source FROM market_history WHERE brand = ? AND model = ? ORDER BY id DESC LIMIT 1`, [bike.brand, bike.model]);
          if (history && history.length > 0) {
              targetBike = { ...bike, source_url: history[0].source_url, source: history[0].source };
          }
      }

      const status = await this.checkBikeAvailability(targetBike);
      
      if (status === 'sold' || status === 'deleted') {
        await this.deactivateBike(bike.id, status);
        removed++;
        console.log(`❌ Removed: ${bike.brand} ${bike.model} (${status})`);
      } else {
        await this.updateLastChecked(bike.id);
        stillAvailable++;
        console.log(`✅ Verified: ${bike.brand} ${bike.model}`);
      }
      
      // Rate limit: 2 sec
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n✅ Freshness check complete:`);
    console.log(`├─ Still available: ${stillAvailable}`);
    console.log(`└─ Removed: ${removed}`);
    
    return { removed, stillAvailable };
  }
  
  async deactivateBike(bikeId, reason) {
    try {
        await db.query(`
          UPDATE bikes
          SET is_active = 0,
              deactivation_reason = ?,
              deactivated_at = datetime('now')
          WHERE id = ?
        `, [reason, bikeId]);
    } catch (e) {
        console.error('Error deactivating bike:', e.message);
    }
  }
  
  async updateLastChecked(bikeId) {
    try {
        await db.query(`
          UPDATE bikes
          SET last_checked = datetime('now')
          WHERE id = ?
        `, [bikeId]);
    } catch (e) {
        console.error('Error updating last_checked:', e.message);
    }
  }
}

module.exports = new AvailabilityChecker();
