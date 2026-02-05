const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

// Config
const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root'
};

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

async function runRemoteCommand() {
    try {
        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('✅ Connected. Diagnosing system...');
            
            const remoteScript = `
                const fs = require('fs');
                const path = require('path');
                const sqlite3 = require('sqlite3');
                const axios = require('axios');
                
                const DB_PATH = '/root/eubike/backend/database/eubike.db';
                const PUBLIC_IMAGES = '/root/eubike/backend/public/images/bikes';
                
                async function run() {
                    console.log('--- DB CHECK ---');
                    if (fs.existsSync(DB_PATH)) {
                        console.log('✅ DB found at ' + DB_PATH);
                        const stats = fs.statSync(DB_PATH);
                        console.log('   Size: ' + stats.size + ' bytes');
                        console.log('   Modified: ' + stats.mtime);
                        
                        const db = new sqlite3.Database(DB_PATH);
                        db.all("SELECT id, name, is_active FROM bikes WHERE is_active = 1", (err, rows) => {
                            if (err) console.error('   DB Error:', err);
                            else {
                                console.log('   Active Bikes in DB:', rows.length);
                                rows.forEach(r => console.log('   - [' + r.id + '] ' + r.name));
                            }
                            db.close();
                        });
                    } else {
                        console.error('❌ DB NOT FOUND at ' + DB_PATH);
                    }
                    
                    console.log('\\n--- IMAGE CHECK ---');
                    // Check if images exist for bike ID 4 (from previous logs)
                    const id4Path = path.join(PUBLIC_IMAGES, 'id4');
                    if (fs.existsSync(id4Path)) {
                        console.log('✅ Image dir for ID 4 found.');
                        const files = fs.readdirSync(id4Path);
                        console.log('   Files:', files.slice(0, 5).join(', '));
                    } else {
                        console.log('❌ Image dir for ID 4 NOT found at ' + id4Path);
                        // Try to find where they are
                        try {
                            const { execSync } = require('child_process');
                            console.log('   Searching for .webp files...');
                            const find = execSync('find /root/eubike -name "0.webp" | head -n 3').toString();
                            console.log('   Found at:\\n' + find);
                        } catch (e) {}
                    }
                    
                    console.log('\\n--- API CHECK ---');
                    try {
                        console.log('   Curling http://localhost:8082/api/bikes ...');
                        const res = await axios.get('http://localhost:8082/api/bikes');
                        console.log('   Status:', res.status);
                        console.log('   Total:', res.data.total);
                        if (res.data.bikes && res.data.bikes.length > 0) {
                            const b = res.data.bikes[0];
                            console.log('   First Bike:', b.name);
                            console.log('   Images Array:', b.images);
                            console.log('   Main Image:', b.image);
                        } else {
                            console.log('   ⚠️ No bikes in API response.');
                        }
                    } catch (e) {
                        console.error('   API Error:', e.message);
                        if (e.response) console.log('   Response:', e.response.data);
                    }
                }
                
                run();
            `;
            
            const scriptBase64 = Buffer.from(remoteScript).toString('base64');
            const cmd = `cd /root/eubike/backend && npm install axios sqlite3 --no-save > /dev/null 2>&1 && echo "${scriptBase64}" | base64 -d > diagnose_remote.js && node diagnose_remote.js && rm diagnose_remote.js`;
            
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log(`\n🎁 Process finished with code ${code}`);
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        }).connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: password
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

runRemoteCommand();
