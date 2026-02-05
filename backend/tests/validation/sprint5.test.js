const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const path = require('path');
const DatabaseManager = require('../../database/db-manager');

// Set Test DB
process.env.DB_PATH = path.resolve(__dirname, '../../database/eubike_test.db');
const dbManager = new DatabaseManager();
const db = dbManager.getDatabase();

// Mock DeepCatalogBuilder
const mockDeepCatalogBuilder = {
    buildDeepCatalogForModel: async (brand, model) => {
        return [{ brand, model, price: 2000 }]; // Return dummy bike
    }
};

// Import Services
const AvailabilityChecker = require('../../src/services/AvailabilityChecker');
const SmartFreshnessScheduler = require('../../src/services/SmartFreshnessScheduler');
const AutoRefillPipeline = proxyquire('../../src/services/auto-refill-pipeline', {
    './deep-catalog-builder': mockDeepCatalogBuilder
});

describe('Sprint 5: Freshness Check', () => {

  before(() => {
      // Ensure refill_queue table exists (dump_schema should have created it)
      // Clear it
      db.prepare('DELETE FROM refill_queue').run();
  });

  it('5.1: Availability checker detects sold bikes', async () => {
    // Create test bike with URL to known sold listing
    const testBike = { 
      id: 9999, 
      source_url: 'https://www.kleinanzeigen.de/s-anzeige/sold-test/123456', 
      source: 'kleinanzeigen' 
    }; 
     
    const status = await AvailabilityChecker.checkBikeAvailability(testBike); 
     
    expect(['sold', 'deleted']).to.include(status); 
  });
   
  it('5.2: Smart priority reduces checks', async () => { 
    const scheduler = new SmartFreshnessScheduler(); 
     
    // Tier 1 new bike: check daily 
    const tier1New = { tier: 1, created_at: new Date('2026-01-27'), last_checked: null }; 
    const p1 = scheduler.getCheckPriority(tier1New); 
    expect(p1.should_check).to.be.true; 
     
    // Tier 3 old bike checked yesterday: skip today 
    const tier3Old = {  
      tier: 3,  
      created_at: new Date('2025-12-01'), 
      last_checked: new Date(Date.now() - 24 * 3600 * 1000) // 24h ago
    }; 
    const p3 = scheduler.getCheckPriority(tier3Old); 
    expect(p3.should_check).to.be.false; 
  });
   
  it('5.3: Auto-refill triggers on removal', async () => { 
    const bike = { id: 888, brand: 'YT', model: 'Capra', tier: 1 }; 
     
    await AutoRefillPipeline.onBikeRemoved(bike); 
     
    // Check refill_queue 
    const queued = db.prepare(` 
      SELECT * FROM refill_queue 
      WHERE brand = 'YT' AND model = 'Capra' 
      ORDER BY created_at DESC LIMIT 1 
    `).get(); 
     
    expect(queued).to.not.be.undefined; 
    expect(queued.reason).to.equal('bike_sold'); 
  }); 

});
