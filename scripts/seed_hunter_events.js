const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(DB_PATH);

const rejections = [
    { type: 'REJECTION', details: JSON.stringify({ stage: 'PRE_FILTER', item: 'KTM Frame Only', reason: 'keywords_blacklist' }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'VALUATION', item: 'Cube Stereo 120', reason: 'Margin too low', margin: 0.15 }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'VALUATION', item: 'Cube Stereo 120', reason: 'Margin too low', margin: 0.12 }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'VALUATION', item: 'Cube Stereo 120', reason: 'Margin too low', margin: 0.18 }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'TECH_DECODER', item: 'Scott Spark RC', reason: 'Not a bike' }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'GEMINI', item: 'Trek Fuel EX', reason: 'Not a bike (parts)' }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'KILL_SWITCH', item: 'Radon Slide', reason: 'Title spam' }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'PRE_FILTER', item: 'Children Bike', reason: 'price_too_low' }) },
    { type: 'REJECTION', details: JSON.stringify({ stage: 'PRE_FILTER', item: 'Broken Bike', reason: 'keywords_blacklist' }) },
];

db.serialize(() => {
    const stmt = db.prepare("INSERT INTO hunter_events (type, source, details, created_at) VALUES (?, 'MockGenerator', ?, datetime('now', '-' || (abs(random() % 10000)) || ' minutes'))");
    
    rejections.forEach(r => {
        stmt.run(r.type, r.details);
    });
    
    stmt.finalize();
    console.log('✅ Injected mock rejections');
});

db.close();
