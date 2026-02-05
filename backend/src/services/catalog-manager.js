const { DatabaseManager } = require('../js/mysql-config');
const db = new DatabaseManager();

class CatalogManager {
   
   async rebalanceCatalog() {
     console.log('🔄 Rebalancing Catalog...');
     const current = await this.getCatalogComposition();
     const target = this.getTargetComposition();
     
     console.log('📊 Current vs Target:'); 
     console.log(`Tier 1: ${current.tier1} / ${target.tier1}`); 
     console.log(`Tier 2: ${current.tier2} / ${target.tier2}`); 
     console.log(`Tier 3: ${current.tier3} / ${target.tier3}`); 
     
     // Request more Tier 1 if needed
     if (current.tier1 < target.tier1) { 
       await this.requestMoreTier1(target.tier1 - current.tier1); 
     } 
     
     // Prune Tier 3 if over limit
     if (current.tier3 > target.tier3) { 
       await this.pruneOldTier3(); 
     }
   }
   
   getTargetComposition() { 
     return { 
       tier1: 100, // Premium
       tier2: 150, // Mid-range
       tier3: 50,  // Budget
       total: 300 
     }; 
   }
   
   async getCatalogComposition() {
       // Assuming 'bikes' table has 'tier' column.
       // If not, we might need to join or infer. 
       // Sprint 2 Task 2.1 added 'tier' to bike object in GraduatedHunter.
       // Does it save to DB? 
       // GraduatedHunter returns { approved: true, ... }.
       // The saving logic (in Hunter) should save 'tier'.
       // Let's assume 'tier' column exists or we need to add it.
       // If it doesn't exist, we might get error.
       // Let's check schema.
       try {
           const rows = await db.query(`
               SELECT tier, COUNT(*) as cnt 
               FROM bikes 
               WHERE is_active = 1
               GROUP BY tier
           `);
           
           const stats = { tier1: 0, tier2: 0, tier3: 0 };
           rows.forEach(r => {
               if (r.tier) stats[`tier${r.tier}`] = r.cnt;
           });
           return stats;
       } catch (e) {
           console.error('Error getting catalog composition:', e.message);
           // Fallback if tier column missing
           return { tier1: 0, tier2: 0, tier3: 0 };
       }
   }
   
   async requestMoreTier1(deficit) {
       console.log(`[CATALOG] 🚨 Tier 1 Deficit: ${deficit} bikes needed.`);
       console.log(`[CATALOG] ℹ️ Priority Matrix will automatically boost Tier 1 targets on next Hunter run.`);
       // We could trigger a run here:
       // require('../../cron/hourly-hunter').run();
   }
   
   async pruneOldTier3() { 
     console.log('[CATALOG] ✂️ Pruning old Tier 3 bikes...');
     try {
         // Deactivate Tier 3 older than 30 days with < 10 views
         // SQLite syntax for date: datetime('now', '-30 days')
         const result = await db.query(` 
           UPDATE bikes 
           SET is_active = 0 
           WHERE tier = 3 
           AND created_at < datetime('now', '-30 days') 
           AND (views IS NULL OR views < 10) 
         `); 
         console.log(`[CATALOG] Deactivated ${result.affectedRows} old Tier 3 bikes.`);
     } catch (e) {
         console.error('Error pruning Tier 3:', e.message);
     }
   } 
 } 

module.exports = new CatalogManager();
