const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Connect to DB
const dbPath = path.resolve(__dirname, '../backend/database/eubike.db');
console.log('Database Path:', dbPath);
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
});

// Determine publicRoot similar to backend
const candidatePublicA = path.resolve(process.cwd(), '../backend/public');
const candidatePublicB = path.resolve(process.cwd(), '../public');
const publicRoot = fs.existsSync(candidatePublicA) ? candidatePublicA : candidatePublicB;
console.log('Public Root:', publicRoot);

function normalizeImagePath(u) {
    if (!u) return '';
    let s = String(u).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/src/images')) s = s.replace(/^\/src\/images/, '/images');
    else if (s.startsWith('src/images')) s = s.replace(/^src\/images/, '/images');
    return s.startsWith('/') ? s : `/${s}`;
}

function localImageExists(u) {
    const rel = normalizeImagePath(u);
    if (!rel) return false;
    if (!rel.startsWith('/images/')) return true; // External or other path
    const filePath = path.join(publicRoot, rel.replace(/^\/images\//, 'images/'));
    try {
        const exists = fs.existsSync(filePath);
        console.log(`Checking: ${filePath} -> ${exists}`);
        return exists;
    } catch {
        return false;
    }
}

// Find a bike added by telegram-bot
const query = `
    SELECT b.id, b.name, b.main_image, group_concat(bi.image_url) as images
    FROM bikes b
    LEFT JOIN bike_images bi ON b.id = bi.bike_id
    WHERE b.source = 'telegram-bot'
    GROUP BY b.id
    ORDER BY b.added_at DESC
    LIMIT 1
`;

db.get(query, [], (err, row) => {
    if (err) {
        console.error('Query error:', err);
        db.close();
        return;
    }

    if (!row) {
        console.log('No bikes found from telegram-bot');
        db.close();
        return;
    }

    console.log('Checking Bike:', row.id, row.name);
    console.log('Main Image (DB):', row.main_image);
    
    if (row.images) {
        const images = row.images.split(',');
        console.log('Total Images (DB):', images.length);
        
        images.forEach((img, idx) => {
            console.log(`Image ${idx}: ${img}`);
            const exists = localImageExists(img);
            console.log(`  -> Exists for backend? ${exists}`);
        });
    } else {
        console.log('No images in bike_images table');
    }
    
    db.close();
});
