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
    if (!fs.existsSync(PASS_FILE)) throw new Error(`Password file not found: ${PASS_FILE}`);
    return fs.readFileSync(PASS_FILE, 'utf8').trim();
}

async function runRemoteCommand() {
    try {
        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('✅ Connected. Fetching logs...');
            
            // Command to get relevant logs
            const cmd = `
                echo "=== PM2 BACKEND LOGS ==="
                pm2 logs eubike-backend --lines 50 --nostream
                
                echo "\n=== NGINX ACCESS LOGS (Last 20) ==="
                tail -n 20 /var/log/nginx/access.log
                
                echo "\n=== NGINX ERROR LOGS (Last 20) ==="
                tail -n 20 /var/log/nginx/error.log
            `;
            
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code) => {
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
