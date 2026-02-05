const path = require('path');
const initSqlJs = require('sql.js');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '../../database/eubike.db');

async function checkImages() {
    try {
        const filebuffer = fs.readFileSync(DB_PATH);
        const SQL = await initSqlJs();
        const db = new SQL.Database(filebuffer);

        const rows = db.exec("SELECT id, name, main_image, source FROM bikes WHERE is_active = 1 LIMIT 20");
        
        console.log('📸 Checking Bike Images in DB:');
        if (rows.length > 0 && rows[0].values) {
            rows[0].values.forEach(r => {
                console.log(`   - ID ${r[0]}: ${r[1]}`);
                console.log(`     Image: ${r[2]}`);
                console.log(`     Source: ${r[3]}`);
            });
        } else {
            console.log('   No active bikes found.');
        }
        db.close();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkImages();
