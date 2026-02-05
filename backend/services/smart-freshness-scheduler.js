const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

class SmartFreshnessScheduler {
  
  getCheckPriority(bike) {
    // Tier 1 (premium) - check more often
    // Old listings - check less often
    
    const now = Date.now();
    const created = new Date(bike.created_at || now).getTime();
    const lastChecked = new Date(bike.last_checked || created).getTime();
    
    const daysSinceCreated = (now - created) / 86400000;
    const daysSinceLastCheck = (now - lastChecked) / 86400000;
    
    let checkInterval = 3; // Default Tier 3
    
    if (bike.tier === 1) {
      checkInterval = 1; // Every 24h
    } else if (bike.tier === 2) {
      checkInterval = 2; // Every 48h
    }
    
    // New listings (< 7 days) - check more often (hot period)
    if (daysSinceCreated < 7) {
      checkInterval = checkInterval * 0.5;
    }
    
    // Old (> 30 days) - check less often (stale)
    if (daysSinceCreated > 30) {
      checkInterval = checkInterval * 1.5;
    }
    
    return {
      should_check: daysSinceLastCheck >= checkInterval,
      priority: (bike.tier || 1) * 10 + (30 - Math.min(30, daysSinceCreated)), // Higher = more urgent
      interval: checkInterval,
      daysSinceLastCheck
    };
  }
  
  async getCheckQueue(limit = 100) {
    try {
        const allActive = await db.query(`
          SELECT * FROM bikes WHERE is_active = 1
        `);
        
        // Filter + Sort
        const queue = allActive
          .map(bike => ({
            ...bike,
            check_priority: this.getCheckPriority(bike)
          }))
          .filter(b => b.check_priority.should_check)
          .sort((a, b) => b.check_priority.priority - a.check_priority.priority)
          .slice(0, limit);
        
        return queue;
    } catch (e) {
        console.error('Error getting check queue:', e.message);
        return [];
    }
  }
}

module.exports = new SmartFreshnessScheduler();
