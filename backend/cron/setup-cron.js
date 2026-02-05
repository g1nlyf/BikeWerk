const cron = require('node-cron');
const HotDealHunter = require('../src/services/HotDealHunter');
const HourlyHunter = require('./hourly-hunter');

console.log('🕐 EUBIKE CATALOG AUTO-POPULATION SCHEDULER\n');
console.log('═'.repeat(60));

// ═══════════════════════════════════════════════════════════════
// SCHEDULE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// 1. HOT DEALS (Buycycle) - Every hour at :05
//    These listings sell within 2-4 hours, so we need to check frequently
const HOT_DEAL_SCHEDULE = '5 * * * *';  // Every hour at :05

// 2. REGULAR HUNT (Kleinanzeigen) - Every 4 hours
//    Less urgency, focus on building diverse catalog
const REGULAR_HUNT_SCHEDULE = '15 */4 * * *';  // Every 4 hours at :15

// 3. FULL CYCLE (Hot + Regular + Health Check) - Every 4 hours
//    Comprehensive check including AI predictions and priority adjustments
const FULL_CYCLE_SCHEDULE = '0 */4 * * *';  // Every 4 hours at :00

// ═══════════════════════════════════════════════════════════════
// TASK DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const hourlyHunter = new HourlyHunter();

/**
 * Task 1: Hot Deals Hunt (Buycycle)
 * Runs every hour - checks 5 newest hot deals
 */
async function runHotDealsOnly() {
    console.log('\n' + '═'.repeat(60));
    console.log('🔥 HOT DEALS HUNT (Buycycle)');
    console.log('═'.repeat(60));
    console.log(`Time: ${new Date().toLocaleString('de-DE')}\n`);
    
    try {
        const stats = await HotDealHunter.hunt(5); // Max 5 per hour
        console.log(`\n✅ Hot Deals Complete: Found ${stats.found}, Added ${stats.added}, Duplicates ${stats.duplicates}\n`);
    } catch (e) {
        console.error('❌ Hot Deal Hunt failed:', e.message);
    }
}

/**
 * Task 2: Full Cycle (Hot + Regular + Health)
 * Runs every 4 hours - comprehensive catalog management
 */
async function runFullCycle() {
    console.log('\n' + '═'.repeat(60));
    console.log('🔄 FULL CATALOG CYCLE');
    console.log('═'.repeat(60));
    console.log(`Time: ${new Date().toLocaleString('de-DE')}\n`);
    
  await hourlyHunter.run();
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE SETUP
// ═══════════════════════════════════════════════════════════════

console.log('📅 Schedules:');
console.log(`   🔥 Hot Deals:    ${HOT_DEAL_SCHEDULE} (every hour at :05)`);
console.log(`   🔄 Full Cycle:   ${FULL_CYCLE_SCHEDULE} (every 4 hours at :00)`);
console.log('\n');

// Hot Deals - Every hour
const hotDealTask = cron.schedule(HOT_DEAL_SCHEDULE, runHotDealsOnly, {
    scheduled: true,
    timezone: "Europe/Berlin"
});

// Full Cycle - Every 4 hours  
const fullCycleTask = cron.schedule(FULL_CYCLE_SCHEDULE, runFullCycle, {
  scheduled: true,
  timezone: "Europe/Berlin"
});

// ═══════════════════════════════════════════════════════════════
// STATUS & NEXT RUNS
// ═══════════════════════════════════════════════════════════════

function getNextRun(minutes) {
  const now = new Date();
  const next = new Date(now);
    next.setMinutes(minutes);
  next.setSeconds(0);
  
  if (next <= now) {
    next.setHours(next.getHours() + 1);
  }
  
  return next.toLocaleString('de-DE');
}

function getNextFullCycle() {
    const now = new Date();
    const next = new Date(now);
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / 4) * 4;
    next.setHours(nextHour);
    next.setMinutes(0);
    next.setSeconds(0);
    
    if (next <= now) {
        next.setHours(next.getHours() + 4);
    }
    
    return next.toLocaleString('de-DE');
}

console.log('⏰ Next scheduled runs:');
console.log(`   🔥 Hot Deals:  ${getNextRun(5)}`);
console.log(`   🔄 Full Cycle: ${getNextFullCycle()}`);
console.log('\n');

console.log('✅ Scheduler active. Press Ctrl+C to stop.\n');

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════

process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping scheduler...');
    hotDealTask.stop();
    fullCycleTask.stop();
    console.log('✅ All tasks stopped.');
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════
// MANUAL RUN SUPPORT
// ═══════════════════════════════════════════════════════════════

// Export for manual triggering
module.exports = {
    runHotDealsOnly,
    runFullCycle
};

// If run directly with --now flag, execute immediately
if (process.argv.includes('--now')) {
    console.log('🚀 Running immediate cycle...\n');
    runFullCycle().then(() => {
        console.log('\n✅ Immediate cycle complete. Scheduler continues...');
    }).catch(err => {
        console.error('❌ Error:', err);
    });
}

if (process.argv.includes('--hot-now')) {
    console.log('🔥 Running immediate hot deal hunt...\n');
    runHotDealsOnly().then(() => {
        console.log('\n✅ Hot deal hunt complete. Scheduler continues...');
    }).catch(err => {
        console.error('❌ Error:', err);
    });
}
