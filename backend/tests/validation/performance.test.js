const { expect } = require('chai');
const path = require('path');
const DatabaseManager = require('../../database/db-manager');

process.env.DB_PATH = path.resolve(__dirname, '../../database/eubike_test.db');
const dbManager = new DatabaseManager();
const db = dbManager.getDatabase();

const ValuationService = require('../../src/services/ValuationService');
const valuationService = new ValuationService();
const HotnessPredictor = require('../../src/services/HotnessPredictor');

describe('Performance: System Under Load', function() {
   this.timeout(60000);

   it('9.1: FMV calculation < 100ms', async () => { 
     const start = Date.now(); 
     await valuationService.calculateFMVWithDepreciation('Canyon', 'Spectral', 2023); 
     const duration = Date.now() - start; 
      
     expect(duration).to.be.lessThan(100); 
   }); 
    
   it('9.2: Batch hotness prediction < 30 sec for 500 bikes', async () => { 
     // Ensure we have 500 bikes (seed data has 500)
     const count = db.prepare('SELECT COUNT(*) as c FROM bikes').get().c;
     if (count < 500) {
         // Seed more if needed
     }
     
     const start = Date.now(); 
     await HotnessPredictor.predictCatalog(); 
     const duration = Date.now() - start; 
      
     expect(duration).to.be.lessThan(30000); // 30 seconds 
   }); 
    
   it('9.3: Database query performance', async () => { 
     const queries = [ 
       'SELECT * FROM bikes WHERE is_active = 1 LIMIT 50', 
       'SELECT * FROM market_history WHERE brand = ? ORDER BY created_at DESC LIMIT 100', 
       'SELECT AVG(hotness_score) FROM bikes WHERE tier = 1' 
     ]; 
      
     for (const query of queries) { 
       const start = Date.now(); 
       if (query.includes('?')) {
           db.prepare(query).all('Canyon');
       } else {
           db.prepare(query).all();
       }
       const duration = Date.now() - start; 
        
       expect(duration).to.be.lessThan(50); // All queries < 50ms 
     } 
   }); 
    
   it('9.4: Concurrent requests handling', async () => { 
     // Simulate 100 concurrent FMV requests 
     const promises = []; 
     for (let i = 0; i < 100; i++) { 
       promises.push( 
         valuationService.calculateFMVWithDepreciation('Canyon', 'Spectral', 2023) 
       ); 
     } 
      
     const start = Date.now(); 
     await Promise.all(promises); 
     const duration = Date.now() - start; 
      
     expect(duration).to.be.lessThan(500); // 100 requests in < 500ms 
   }); 
});
