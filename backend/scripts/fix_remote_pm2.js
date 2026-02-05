
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
            console.log('✅ Connected. Force Resetting PM2 with Explicit CWD...');
            
            const cmd = `
                echo "=== Nuking PM2 ==="
                pm2 kill
                
                echo "=== Cleaning up rogue DBs again ==="
                rm -rf /root/backend/database
                
                echo "=== Checking .env DB_PATH ==="
                grep "DB_PATH" /root/eubike/backend/.env || echo "DB_PATH not found in .env"
                
                echo "=== Starting Services with Explicit CWD ==="
                cd /root/eubike
                
                # Start Backend
                # We use --cwd /root/eubike to ensure process.cwd() is correct
                pm2 start backend/server.js --name eubike-backend --cwd /root/eubike --update-env
                
                # Start Bots
                pm2 start telegram-bot/bot.js --name eubike-bot --cwd /root/eubike --update-env
                pm2 start telegram-bot/admin-bot.js --name eubike-admin-bot --cwd /root/eubike --update-env
                pm2 start telegram-bot/manager-bot.js --name eubike-manager-bot --cwd /root/eubike --update-env
                pm2 start client-telegram-bot/src/index.js --name eubike-client-bot --cwd /root/eubike --update-env
                
                pm2 save
                
                echo "=== Waiting for Startup (10s) ==="
                sleep 10
                
                echo "=== Verifying Backend Log ==="
                pm2 logs eubike-backend --lines 20 --nostream
                
                echo "=== Checking Port ==="
                netstat -tuln | grep 8082
            `;

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code) => {
                    console.log(`\n✨ PM2 Reset Finished (Code: ${code})`);
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
