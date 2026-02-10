const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
cd /root/eubike/backend &&
echo "=== Fixing main_image for bikes 3 and 5 ===" &&
node -e "
const db = require('better-sqlite3')('./database/eubike.db');

// Find first ImageKit URL for bike 3
const bike3img = db.prepare(\\\"SELECT local_path FROM bike_images WHERE bike_id = 3 AND local_path LIKE '%imagekit%' ORDER BY id LIMIT 1\\\").get();
if (bike3img) {
    db.prepare('UPDATE bikes SET main_image = ? WHERE id = 3').run(bike3img.local_path);
    console.log('Bike 3 fixed:', bike3img.local_path);
} else {
    console.log('Bike 3: No imagekit images found');
}

// Find first ImageKit URL for bike 5
const bike5img = db.prepare(\\\"SELECT local_path FROM bike_images WHERE bike_id = 5 AND local_path LIKE '%imagekit%' ORDER BY id LIMIT 1\\\").get();
if (bike5img) {
    db.prepare('UPDATE bikes SET main_image = ? WHERE id = 5').run(bike5img.local_path);
    console.log('Bike 5 fixed:', bike5img.local_path);
} else {
    console.log('Bike 5: No imagekit images found');
}

// Delete all cloudfront URLs from bike_images
const deleted = db.prepare(\\\"DELETE FROM bike_images WHERE local_path LIKE '%cloudfront%'\\\").run();
console.log('Deleted cloudfront entries:', deleted.changes);

// Verify
console.log('');
console.log('=== Verification ===');
const bikes = db.prepare('SELECT id, brand, main_image FROM bikes').all();
bikes.forEach(b => {
    const ok = b.main_image && b.main_image.includes('imagekit');
    console.log('[' + b.id + '] ' + (ok ? '✓' : '✗') + ' ' + b.brand + ': ' + (b.main_image ? b.main_image.substring(0, 60) + '...' : 'NULL'));
});
" &&
echo "" &&
echo "=== Restarting backend ===" &&
cd /root/eubike &&
pm2 restart eubike-backend &&
sleep 2 &&
echo "" &&
echo "=== Test API for images ===" &&
curl -s "http://localhost:8082/api/catalog/bikes?limit=5" | jq '[.bikes[] | {id, brand, main_image: (.main_image // .media.main_image // .image)}]' 2>/dev/null || echo "jq not available"
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n\n✅ Images fixed!');
            console.log('Please hard refresh (Ctrl+Shift+R) the browser.');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
