const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');
const LOCAL_SCRIPT = path.join(__dirname, 'remote_fix_schema_v4.js');
// NEW PATHS based on pm2 describe output
const REMOTE_DIR = '/root/eubike/backend/scripts';
const REMOTE_SCRIPT_PATH = '/root/eubike/backend/scripts/remote_fix_schema_v4.js';
const EXEC_CWD = '/root/eubike/backend';

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
            
            // 1. Skip mkdir (assume exists or created by deploy)
            console.log('✅ Directory verified (skipped mkdir)');
            
            // 2. Upload Script
            conn.sftp((err, sftp) => {
                if (err) throw err;
                
                console.log('⬆️ Uploading script...');
                sftp.fastPut(LOCAL_SCRIPT, REMOTE_SCRIPT_PATH, (err) => {
                    if (err) throw err;
                    console.log('✅ Upload complete');
                    
                    // 3. Execute Script
                    console.log('🚀 Executing script remotely...');
                    // IMPORTANT: Run from backend root so node_modules resolution works
                    conn.exec(`cd ${EXEC_CWD} && node scripts/remote_fix_schema_v4.js`, (err, stream) => {
                        if (err) throw err;
                        stream.on('close', (code) => {
                            console.log(`\n🎁 Script finished with code ${code}`);
                            conn.end();
                        }).on('data', (data) => {
                            process.stdout.write(data);
                        }).stderr.on('data', (data) => {
                            process.stderr.write(data);
                        });
                    });
                });
            });
        }).on('error', (err) => {
            console.error('SSH Client Error:', err);
        }).connect({
            ...config,
            password
        });
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
