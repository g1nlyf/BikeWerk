
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
            console.log('✅ Connected. Checking Backend Status...');
            
            // Commands to check status and logs
            const cmd = `
                echo "=== 1. PM2 STATUS ==="
                pm2 list
                
                echo "\n=== 2. PORT 8082 CHECK ==="
                netstat -tuln | grep 8082 || echo "❌ Port 8082 NOT listening"
                
                echo "\n=== 3. BACKEND LOGS (Last 50 lines) ==="
                pm2 logs eubike-backend --lines 50 --nostream
                
                echo "\n=== 4. DB INTEGRITY CHECK ==="
                cd /root/eubike/backend
                node -e "const db=new (require('better-sqlite3'))('database/eubike.db'); console.log('DB Valid. Bikes count:', db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);" || echo "❌ DB Check Failed"
            `;

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log(`\n🎁 Diagnosis finished with code ${code}`);
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
