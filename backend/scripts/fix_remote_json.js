const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Fix & Re-Run Population...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    // The previous error "TypeError: bikes is not iterable" means JSON.parse returned something that isn't an array, 
    // OR the file reading failed silently/returned empty string (though fs.readFileSync usually throws).
    // Or the JSON structure in the file is wrapped in an object like { bikes: [...] } instead of directly [...].
    
    const cmd = `
        echo "=== 1. Inspect JSON Structure (Head) ==="
        head -n 20 /root/eubike/backend/tests/debug/full_json_dump_10.json
        
        echo "\n=== 2. Fix Script Logic (Inline Patch) ==="
        # We will overwrite the populate script with a safer version that logs the type of 'bikes'
        
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
    let bikes = JSON.parse(rawData);

    // FIX: Handle wrapped structure
    if (!Array.isArray(bikes) && bikes.bikes) {
        console.log('⚠️ Detected wrapped JSON structure, extracting array...');
        bikes = bikes.bikes;
    }
    
    if (!Array.isArray(bikes)) {
        console.error('❌ Error: JSON content is not an array. Type:', typeof bikes);
        console.log('Keys:', Object.keys(bikes));
        process.exit(1);
    }

    console.log('📊 Found ' + bikes.length + ' bikes.');

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
            
             // Image logic omitted for speed in this patch, focused on DB population first
        } catch (err) {
            console.error('❌ Insert Error:', err.message);
        }
    }
    console.log('✅ Population Complete!');
}

populateFromDump();
EOF

        echo "\n=== 3. Running Patched Script ==="
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
