
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/eubike.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(bikes)", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    const columns = rows.map(r => r.name);
    console.log('Columns in bikes table:', columns.join(', '));
    
    const missing = [
        'condition_class', 
        'condition_confidence', 
        'condition_rationale', 
        'technical_score', 
        'visual_rating', 
        'functional_rating'
    ].filter(c => !columns.includes(c));
    
    if (missing.length > 0) {
        console.log('❌ Missing columns:', missing.join(', '));
    } else {
        console.log('✅ All target columns exist.');
    }
    
    // Check if 'condition_reason' exists (maybe alias for rationale?)
    if (columns.includes('condition_reason')) {
        console.log('ℹ️ condition_reason exists (might be rationale alias)');
    }
});
