const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Fix (Object Keys) & Re-Run Population...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    const cmd = `
        cat > /root/eubike/backend/scripts/populate_from_dump.js << 'EOF'
const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('../src/js/mysql-config');
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function downloadImage(url, filepath) {
    if (!url) return;
    try {
        const response = await axios({
            url, method: 'GET', responseType: 'stream', httpsAgent: agent, timeout: 10000
        });
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (e) {
        console.error('Failed img:', url);
    }
}

async function populateFromDump() {
    console.log('🚀 Starting Data Population...');
    const db = new DatabaseManager();
    await db.initialize();

    const dumpPath = path.join(__dirname, '../tests/debug/full_json_dump_10.json');
    console.log('Reading:', dumpPath);
    
    const rawData = fs.readFileSync(dumpPath, 'utf8');
    let bikesData = JSON.parse(rawData);
    let bikes = [];

    // FIX: Handle Object structure {"1": {...}, "2": {...}}
    if (!Array.isArray(bikesData)) {
        console.log('⚠️ Detected Object structure, converting to Array via Object.values()...');
        bikes = Object.values(bikesData);
    } else {
        bikes = bikesData;
    }
    
    console.log('📊 Found ' + bikes.length + ' bikes to process.');

    const imagesDir = path.join(__dirname, '../public/images/bikes');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    for (const bike of bikes) {
        try {
            const name = bike.basic_info?.name || bike.name || 'Unknown';
            console.log('   ⚙️ Processing: ' + name);

            // Insert
            const result = await db.query(\`
                INSERT INTO bikes 
                (name, description, price, year, brand, model, category, 
                 size, wheel_size, frame_material, condition_score, quality_score, 
                 main_image, source_url, created_at, is_active, ranking_score, priority, condition_grade,
                 original_price, discount, fmv, condition_status, needs_audit, audit_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'high', ?, ?, ?, ?, 'used', 0, 'approved')
            \`, [
                name,
                bike.basic_info?.description || '',
                bike.pricing?.price || 0,
                bike.basic_info?.year || 2020,
                bike.basic_info?.brand || 'Other',
                bike.basic_info?.model || 'Model',
                bike.basic_info?.category || 'Road',
                bike.specs?.frame_size || 'M',
                bike.specs?.wheel_size || '29"',
                bike.specs?.frame_material || 'Aluminum',
                bike.condition?.score || 80,
                bike.quality_score || 80,
                '',
                bike.meta?.source_url || '',
                new Date().toISOString(),
                bike.ranking?.ranking_score || 100,
                bike.condition?.grade || 'Great',
                bike.pricing?.original_price || bike.pricing?.price || 0,
                bike.pricing?.discount || 0,
                bike.pricing?.fmv || bike.pricing?.price || 0
            ]);
            
            const bikeId = result.lastInsertRowid;
            const bikeDir = path.join(imagesDir, \`id\${bikeId}\`);
            if (!fs.existsSync(bikeDir)) fs.mkdirSync(bikeDir, { recursive: true });
            
            // Download Main Image
            let localMainImage = '';
            const mainImgUrl = bike.media?.main_image;
            if (mainImgUrl) {
                const filename = '0.webp';
                const localPath = path.join(bikeDir, filename);
                await downloadImage(mainImgUrl, localPath);
                
                if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
                    localMainImage = \`/images/bikes/id\${bikeId}/\${filename}\`;
                    await db.query('UPDATE bikes SET main_image = ? WHERE id = ?', [localMainImage, bikeId]);
                    await db.query('INSERT INTO bike_images (bike_id, image_url, is_main, image_order) VALUES (?, ?, 1, 0)', [bikeId, localMainImage]);
                }
            }
            
        } catch (err) {
            console.error('❌ Insert Error:', err.message);
        }
    }
    console.log('✅ Population Complete!');
}

populateFromDump();
EOF

        echo "\n=== Running Patched Script ==="
        cd /root/eubike/backend
        node scripts/populate_from_dump.js
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('🎁 Fix Finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
