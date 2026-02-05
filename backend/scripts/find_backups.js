
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root'
};

async function readPassword() {
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

async function run() {
    try {
        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('✅ Connected. Searching for backups...');
            
            const cmd = `
                echo "=== Searching for .db files ==="
                find /root -name "*.db" -o -name "*.db.bak" -o -name "*.sqlite"
                
                echo "\n=== Checking backend/Databases folder ==="
                ls -l /root/eubike/backend/Databases/
                
                echo "\n=== Checking root backups ==="
                ls -l /root/*.bak
            `;

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code) => {
                    conn.end();
                }).on('data', (data) => process.stdout.write(data));
            });
        }).connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: password
        });
    } catch (e) { console.error(e); }
}

run();
