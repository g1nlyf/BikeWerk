const { DatabaseManager } = require('../js/mysql-config');
const db = new DatabaseManager();
const DeepCatalogBuilder = require('./deep-catalog-builder');

class AutoRefillPipeline {
   
   async onBikeRemoved(removedBike) { 
     console.log(`🔄 Auto-refill triggered: ${removedBike.brand} ${removedBike.model}`); 
      
     try {
         // Add to refill queue
         await db.query(` 
           INSERT INTO refill_queue (brand, model, tier, reason, created_at) 
           VALUES (?, ?, ?, 'bike_sold', datetime('now')) 
         `, [removedBike.brand, removedBike.model, removedBike.tier]); 
          
         // Tier 1 Urgent Refill
         if (removedBike.tier === 1) { 
           console.log('🚨 Tier 1 urgent refill!'); 
           await this.urgentRefill(removedBike); 
         }
     } catch (e) {
         console.error('Error in auto-refill:', e.message);
     }
   } 
    
   async urgentRefill(bike) { 
     // Mini-cycle for this model
     console.log(`🚀 Starting Urgent Refill for ${bike.brand} ${bike.model}`);
     
     try {
         const newBikes = await DeepCatalogBuilder.buildDeepCatalogForModel( 
           bike.brand, bike.model 
         ); 
          
         console.log(`✅ Urgent refill complete: +${newBikes.length} bikes`);
         return newBikes;
     } catch (e) {
         console.error('Error in urgent refill:', e.message);
         return [];
     }
   } 
}

module.exports = new AutoRefillPipeline();
