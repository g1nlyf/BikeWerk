const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

async function runRemoteHunt() {
    console.log('🚀 Triggering Remote Nuclear Hunt...');
    
    const password = await readPassword();
    const conn = new Client();

    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            console.log('✅ SSH Connection established');
            
            // Run the hunt script in background (nohup) or foreground?
            // Foreground to see logs is better for verification.
            // We use 'node backend/scripts/nuclear_hunt_protocol.js'
            const cmd = 'cd /root/eubike && node backend/scripts/nuclear_hunt_protocol.js';
            
            console.log(`💻 Executing: ${cmd}`);
            
            conn.exec(cmd, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                stream.on('close', (code, signal) => {
                    console.log(`Command exited with code: ${code}`);
                    conn.end();
                    if (code === 0) resolve();
                    else reject(new Error(`Remote hunt failed with code ${code}`));
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        }).on('error', (err) => {
            reject(err);
        }).connect({
            host: '45.9.41.232',
            port: 22,
            username: 'root',
            password: password
        });
    });
}

runRemoteHunt().catch(console.error);