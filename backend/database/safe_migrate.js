const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'eubike.db');
const db = new Database(dbPath);

console.log(`Running Safe Migration on: ${dbPath}`);

function addColumnIfNotExists(table, column, definition) {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = info.some(c => c.name === column);
    if (!exists) {
        console.log(`Adding ${column} to ${table}...`);
        try {
            db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
            console.log('✅ Done');
        } catch (e) {
            console.error(`❌ Failed: ${e.message}`);
        }
    } else {
        console.log(`✅ ${column} exists in ${table}`);
    }
}

// BIKES
console.log('\n--- Migrating BIKES ---');
addColumnIfNotExists('bikes', 'location', 'TEXT');
addColumnIfNotExists('bikes', 'size', 'TEXT');
addColumnIfNotExists('bikes', 'wheel_diameter', 'TEXT');
addColumnIfNotExists('bikes', 'original_url', 'TEXT');
addColumnIfNotExists('bikes', 'priority', "TEXT DEFAULT 'normal'");
addColumnIfNotExists('bikes', 'hotness_score', 'REAL DEFAULT 0');
addColumnIfNotExists('bikes', 'views', 'INTEGER DEFAULT 0');
addColumnIfNotExists('bikes', 'last_checked', 'DATETIME');
addColumnIfNotExists('bikes', 'deactivation_reason', 'TEXT');
addColumnIfNotExists('bikes', 'deactivated_at', 'DATETIME');
addColumnIfNotExists('bikes', 'source_url', 'TEXT');
addColumnIfNotExists('bikes', 'fmv', 'REAL');
addColumnIfNotExists('bikes', 'currency', 'TEXT');
addColumnIfNotExists('bikes', 'quality_score', 'REAL');
addColumnIfNotExists('bikes', 'source_platform', 'TEXT');
addColumnIfNotExists('bikes', 'unified_data', 'TEXT');
addColumnIfNotExists('bikes', 'specs_json', 'TEXT');
addColumnIfNotExists('bikes', 'inspection_json', 'TEXT');
addColumnIfNotExists('bikes', 'seller_json', 'TEXT');
addColumnIfNotExists('bikes', 'logistics_json', 'TEXT');
addColumnIfNotExists('bikes', 'features_json', 'TEXT');
addColumnIfNotExists('bikes', 'sub_category', 'TEXT');
addColumnIfNotExists('bikes', 'price_history_json', 'TEXT');
addColumnIfNotExists('bikes', 'media_json', 'TEXT');
addColumnIfNotExists('bikes', 'ranking_json', 'TEXT');
addColumnIfNotExists('bikes', 'audit_json', 'TEXT');
addColumnIfNotExists('bikes', 'ai_analysis_json', 'TEXT');
addColumnIfNotExists('bikes', 'market_data_json', 'TEXT');
addColumnIfNotExists('bikes', 'internal_json', 'TEXT');
addColumnIfNotExists('bikes', 'completeness', 'REAL');

// MARKET_HISTORY
console.log('\n--- Migrating MARKET_HISTORY ---');
addColumnIfNotExists('market_history', 'frame_material', 'TEXT');
addColumnIfNotExists('market_history', 'trim_level', 'TEXT');
addColumnIfNotExists('market_history', 'quality_score', 'INTEGER DEFAULT 100');
addColumnIfNotExists('market_history', 'category', 'TEXT');
addColumnIfNotExists('market_history', 'year', 'INTEGER');
addColumnIfNotExists('market_history', 'title', 'TEXT');
addColumnIfNotExists('market_history', 'frame_size', 'TEXT');
addColumnIfNotExists('market_history', 'condition', 'TEXT');
addColumnIfNotExists('market_history', 'source_platform', 'TEXT');
addColumnIfNotExists('market_history', 'source_ad_id', 'TEXT');

// Special handling for created_at (DEFAULT CURRENT_TIMESTAMP is not supported in ALTER)
const mhInfo = db.prepare('PRAGMA table_info(market_history)').all();
if (!mhInfo.some(c => c.name === 'created_at')) {
    console.log('Adding created_at to market_history...');
    db.prepare('ALTER TABLE market_history ADD COLUMN created_at DATETIME').run();
    db.prepare("UPDATE market_history SET created_at = datetime('now')").run();
    
    // Create trigger for future inserts
    try {
        db.exec(`
        CREATE TRIGGER IF NOT EXISTS set_created_at_market_history 
        AFTER INSERT ON market_history
        FOR EACH ROW
        WHEN NEW.created_at IS NULL
        BEGIN
            UPDATE market_history SET created_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        `);
        console.log('✅ created_at added with trigger');
    } catch(e) {
        console.error('Trigger error:', e.message);
    }
} else {
    console.log('✅ created_at exists in market_history');
}


// TABLES
console.log('\n--- Creating Tables ---');
db.exec(`
CREATE TABLE IF NOT EXISTS refill_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  tier INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE TABLE IF NOT EXISTS needs_manual_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT,
  model TEXT,
  year INTEGER,
  price INTEGER,
  reason TEXT,
  source_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);
console.log('✅ Tables ensured');

// BIKE_IMAGES
console.log('\n--- Migrating BIKE_IMAGES ---');
addColumnIfNotExists('bike_images', 'local_path', 'TEXT');
addColumnIfNotExists('bike_images', 'image_type', 'TEXT');
addColumnIfNotExists('bike_images', 'position', 'INTEGER DEFAULT 0');
addColumnIfNotExists('bike_images', 'is_downloaded', 'INTEGER DEFAULT 0');
addColumnIfNotExists('bike_images', 'download_attempts', 'INTEGER DEFAULT 0');
addColumnIfNotExists('bike_images', 'download_failed', 'INTEGER DEFAULT 0');
addColumnIfNotExists('bike_images', 'width', 'INTEGER');
addColumnIfNotExists('bike_images', 'height', 'INTEGER');
addColumnIfNotExists('bike_images', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

// INDEXES
console.log('\n--- Creating Indexes ---');
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bikes_hotness ON bikes(hotness_score DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bikes_tier_active ON bikes(tier, is_active)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bikes_last_checked ON bikes(last_checked)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bikes_brand_category ON bikes(brand, category)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bikes_price_quality ON bikes(price, quality_score)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bikes_source_platform ON bikes(source_platform, source_ad_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bikes_created_at ON bikes(created_at DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bike_images_bike_id ON bike_images(bike_id)`);
    console.log('✅ Indexes ensured');
} catch(e) {
    console.error('Index creation warning:', e.message);
}

console.log('\n✨ Migration Complete');
