const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'eubike.db');
console.log(`Auditing DB at: ${dbPath}`);

const REQUIRED_SCHEMA = {
  bikes: [
    'id', 'brand', 'model', 'year', 'price', 'tier',
    'fmv', 'source', 'source_url', 'is_active', 'location', 'size',
    'wheel_diameter', 'priority', 'hotness_score', 'views',
    'last_checked', 'created_at', 'updated_at', 'deactivation_reason',
    'deactivated_at', 'original_url'
  ],
  market_history: [
    'id', 'brand', 'model', 'year', 'price_eur',
    'frame_size', 'category', 'quality_score',
    'trim_level', 'frame_material', 'source_url', 'created_at',
    'title', 'condition'
  ],
  refill_queue: [
    'id', 'brand', 'model', 'tier', 'reason', 'status', 'created_at'
  ],
  needs_manual_review: [
    'id', 'brand', 'model', 'reason', 'status', 'created_at'
  ]
};

function validateSchema() {
  console.log('🔍 Validating Database Schema...\n');
  
  let allValid = true;
  const db = new Database(dbPath, { readonly: true });

  for (const [table, requiredCols] of Object.entries(REQUIRED_SCHEMA)) {
    try {
        const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
        if (tableInfo.length === 0) {
            console.log(`📋 Table: ${table} - ❌ MISSING TABLE`);
            allValid = false;
            continue;
        }
        
        const existingCols = tableInfo.map(col => col.name);
        console.log(`📋 Table: ${table}`);
        
        const missing = requiredCols.filter(col => !existingCols.includes(col));
        const extra = existingCols.filter(col => !requiredCols.includes(col));
        
        if (missing.length > 0) {
          console.log(`  ❌ Missing columns: ${missing.join(', ')}`);
          allValid = false;
        }
        
        // Extra columns are fine, just warning or info
        // if (extra.length > 0) {
        //   console.log(`  ℹ️  Extra columns: ${extra.join(', ')}`);
        // }
        
        if (missing.length === 0) {
          console.log(`  ✅ Schema valid (${existingCols.length} columns)`);
        }
        
        console.log('');
    } catch (e) {
        console.log(`📋 Table: ${table} - ❌ ERROR: ${e.message}`);
        allValid = false;
    }
  }
  
  if (allValid) {
    console.log('🎉 All schemas valid!\n');
    process.exit(0);
  } else {
    console.log('❌ Schema validation failed. Migration required.\n');
    process.exit(1);
  }
}

validateSchema();
