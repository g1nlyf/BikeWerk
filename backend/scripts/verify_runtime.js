
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
            console.log('✅ Connected. Verifying Runtime State...');
            
            const cmd = `
                echo "=== Directory Check ==="
                ls -ld /root/backend
                ls -ld /root/eubike/backend
                
                echo "\n=== API Check (Localhost) ==="
                curl -s "http://localhost:8082/api/bikes?limit=1" | head -c 500
                
                echo "\n\n=== DB Check (/root/backend/database/eubike.db) ==="
                if [ -f /root/backend/database/eubike.db ]; then
                    cd /root/backend
                    node -e "const db=new (require('better-sqlite3'))('database/eubike.db'); console.log('Bikes:', db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);"
                else
                    echo "File not found"
                fi
                
                echo "\n=== DB Check (/root/eubike/backend/database/eubike.db) ==="
                if [ -f /root/eubike/backend/database/eubike.db ]; then
                    cd /root/eubike/backend
                    node -e "const db=new (require('better-sqlite3'))('database/eubike.db'); console.log('Bikes:', db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);"
                else
                    echo "File not found"
                fi
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
