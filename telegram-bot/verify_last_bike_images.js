const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(dbPath);

const backendPublicDir = path.resolve(__dirname, '../backend/public');

function checkImages() {
    db.get('SELECT * FROM bikes ORDER BY id DESC LIMIT 1', (err, bike) => {
        if (err) {
            console.error('Error getting last bike:', err);
            return;
        }
        if (!bike) {
            console.log('No bikes found.');
            return;
        }

        console.log(`Checking last bike ID: ${bike.id} (${bike.name})`);
        console.log(`Source: ${bike.source}`);
        console.log(`Created At: ${bike.created_at}`);
        console.log(`Main Image in DB: ${bike.main_image}`);

        db.all('SELECT * FROM bike_images WHERE bike_id = ? ORDER BY image_order', [bike.id], (err, images) => {
            if (err) {
                console.error('Error getting images:', err);
                return;
            }

            console.log(`Found ${images.length} images in bike_images table.`);
            images.forEach(img => {
                console.log(`- [Order ${img.image_order}] ${img.image_url} (Main: ${img.is_main})`);
                
                // Check file existence
                const relPath = img.image_url;
                if (relPath.startsWith('/images/')) {
                    const fsPath = path.join(backendPublicDir, relPath.replace(/^\/images\//, 'images/'));
                    const exists = fs.existsSync(fsPath);
                    console.log(`  -> File check: ${exists ? 'EXISTS' : 'MISSING'} at ${fsPath}`);
                } else {
                    console.log(`  -> External URL, skipping file check.`);
                }
            });

            // Check directory
            const dirPath = path.join(backendPublicDir, 'images/bikes', `id${bike.id}`);
            console.log(`Checking directory: ${dirPath}`);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                console.log(`Files in directory (${files.length}):`, files);
            } else {
                console.log('Directory does not exist!');
            }
        });
    });
}

checkImages();

