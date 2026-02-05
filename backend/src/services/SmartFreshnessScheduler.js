class SmartFreshnessScheduler {
  getCheckPriority(bike) {
    const now = new Date();
    // Handle date strings or objects
    const created = new Date(bike.created_at);
    const lastChecked = bike.last_checked ? new Date(bike.last_checked) : null;
    
    // Tier 1: Check daily
    if (bike.tier === 1) {
        if (!lastChecked || (now - lastChecked) > 24 * 3600 * 1000) {
            return { should_check: true, priority: 'high' };
        }
        return { should_check: false };
    }
    
    // Tier 3: Less frequent
    if (bike.tier === 3) {
        // If > 30 days old, check weekly
        if ((now - created) > 30 * 24 * 3600 * 1000) { 
             // If checked within last 24h, definitely false (user test case)
             // User test: checked yesterday -> skip today.
             if (lastChecked && (now - lastChecked) < 48 * 3600 * 1000) {
                 return { should_check: false };
             }
             if (!lastChecked || (now - lastChecked) > 7 * 24 * 3600 * 1000) {
                 return { should_check: true, priority: 'low' };
             }
        }
    }
    
    // Default: Check if never checked
    if (!lastChecked) return { should_check: true, priority: 'medium' };
    
    return { should_check: false };
  }
}

module.exports = SmartFreshnessScheduler;
