const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

const IMAGES_DIR = path.resolve(__dirname, '../backend/public/images/bikes');

db.serialize(() => {
    console.log('🧹 Clearing Database...');
    
    db.run('DELETE FROM bikes', (err) => {
        if (err) console.error('Error clearing bikes:', err);
        else console.log('✅ Bikes table cleared');
    });

    db.run('DELETE FROM bike_images', (err) => {
        if (err) console.error('Error clearing bike_images:', err);
        else console.log('✅ Bike images table cleared');
    });

    db.run('DELETE FROM market_history', (err) => {
        if (err) console.error('Error clearing market_history:', err);
        else console.log('✅ Market history table cleared');
    });
    
    // Reset sequences
    db.run('DELETE FROM sqlite_sequence WHERE name IN ("bikes", "bike_images", "market_history")', (err) => {
        if (err) console.error('Error resetting sequences:', err);
        else console.log('✅ Sequences reset');
    });

    // Clear Image Files
    if (fs.existsSync(IMAGES_DIR)) {
        try {
            console.log(`🗑️ Deleting images from ${IMAGES_DIR}...`);
            fs.rmSync(IMAGES_DIR, { recursive: true, force: true });
            fs.mkdirSync(IMAGES_DIR, { recursive: true });
            console.log('✅ Image directory cleared and recreated');
        } catch (e) {
            console.error('Error clearing images directory:', e.message);
        }
    } else {
        // Create if not exists
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
        console.log('✅ Image directory created');
    }
});

db.close(() => {
    console.log('🏁 Database reset complete.');
});
