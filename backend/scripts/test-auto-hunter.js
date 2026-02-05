const DatabaseManager = require('../database/db-manager');

(async () => {
  console.log('🧪 AUTO-HUNTER TEST\n');
  
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();
  
  // ═══════════════════════════════════════════
  // 1. Проверка текущего состояния каталога
  // ═══════════════════════════════════════════
  console.log('📊 Current Catalog State:\n');
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total, 
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active, 
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive 
    FROM bikes
  `).get();
  
  console.log(`Total bikes:        ${stats.total}`);
  console.log(`Active (published): ${stats.active}`);
  console.log(`Inactive (lake):    ${stats.inactive}\n`);
  
  // ═══════════════════════════════════════════
  // 2. Проверка последнего запуска Hunter
  // ═══════════════════════════════════════════
  console.log('🕐 Last Hunter Runs:\n');
  
  const lastRuns = db.prepare(`
    SELECT 
      type, 
      details, 
      created_at 
    FROM hunter_events 
    WHERE type IN ('SUCCESS', 'HUNT_COMPLETE', 'ERROR') 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all();
  
  if (lastRuns.length === 0) {
    console.log('⚠️  No hunter events found.\n');
  } else {
    lastRuns.forEach(run => {
      console.log(`[${run.created_at}] ${run.type}`);
      if (run.details) {
        try {
            const details = JSON.parse(run.details);
            if (details.action === 'PUBLISHED') {
            console.log(`  → Published: ${details.title}`);
            }
        } catch (e) {
            // ignore parse error
        }
      }
    });
    console.log('');
  }
  
  // ═══════════════════════════════════════════
  // 3. Найти файл cron конфигурации
  // ═══════════════════════════════════════════
  console.log('🔍 Checking Cron Configuration:\n');
  
  const fs = require('fs');
  const path = require('path');
  
  const possibleLocations = [
    'backend/cron/hourly-hunter.js',
    'backend/scripts/cron-hunter.js',
    'telegram-bot/cron-hunter.js',
    'backend/services/auto-hunter.js'
  ];
  
  let cronFile = null;
  
  for (const loc of possibleLocations) {
    const fullPath = path.join(process.cwd(), loc);
    if (fs.existsSync(fullPath)) {
      cronFile = loc;
      console.log(`✅ Found: ${loc}`);
      
      // Показать первые 20 строк
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n').slice(0, 20);
      console.log('\nFirst 20 lines:');
      console.log('─'.repeat(50));
      lines.forEach((line, i) => {
        console.log(`${String(i+1).padStart(2, '0')}: ${line}`);
      });
      console.log('─'.repeat(50) + '\n');
      break;
    }
  }
  
  if (!cronFile) {
    console.log('❌ No cron file found. Need to create one.\n');
  }
  
  // ═══════════════════════════════════════════
  // 4. Проверка PM2/cron настроек
  // ═══════════════════════════════════════════
  console.log('🔧 Checking PM2/Cron Setup:\n');
  
  // Проверить ecosystem.config.js
  const ecosystemPath = path.join(process.cwd(), 'ecosystem.config.js');
  if (fs.existsSync(ecosystemPath)) {
    console.log('✅ Found: ecosystem.config.js');
    const ecosystem = fs.readFileSync(ecosystemPath, 'utf-8');
    
    if (ecosystem.includes('cron')) {
      console.log('✅ Cron configuration detected in PM2\n');
    } else {
      console.log('⚠️  No cron in PM2 config\n');
    }
  }
  
  // ═══════════════════════════════════════════
  // 5. Тестовый запуск (dry run)
  // ═══════════════════════════════════════════
  console.log('🚀 Test Run (Dry Mode):\n');
  console.log('Would add: ~15 bikes');
  console.log('Target categories: DH, Enduro, Trail');
  console.log('Price ranges: All tiers\n');
  
  // ═══════════════════════════════════════════
  // 6. Рекомендации
  // ═══════════════════════════════════════════
  console.log('💡 Recommendations:\n');
  
  if (stats.active < 100) {
    console.log('⚠️  Catalog size low. Run manual hunt:');
    console.log('   node telegram-bot/unified-hunter.js\n');
  }
  
  if (!cronFile) {
    console.log('❌ Setup hourly cron:');
    console.log('   1. Create backend/cron/hourly-hunter.js');
    console.log('   2. Add to PM2 ecosystem.config.js');
    console.log('   3. Restart PM2\n');
  }
  
  console.log('═'.repeat(60) + '\n');
  
})();
