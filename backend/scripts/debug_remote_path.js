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

async function run() {
    try {
        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('✅ Connected via SSH');
            
            // Check PM2 Info
            conn.exec('pm2 describe eubike-backend', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log(`PM2 finished with code ${code}`);
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    console.log('STDERR: ' + data);
                });
            });
        }).connect({
            ...config,
            password
        });
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
