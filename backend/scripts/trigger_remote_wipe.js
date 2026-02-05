const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');
const SCRIPT_NAME = 'remote_wipe_bikes.js';
const LOCAL_SCRIPT = path.join(__dirname, SCRIPT_NAME);
const REMOTE_SCRIPT = `/root/eubike/backend/scripts/${SCRIPT_NAME}`;

// Read Password
let password;
try {
    password = fs.readFileSync(PASS_FILE, 'utf8').trim();
} catch (e) {
    console.error('❌ Could not read password file:', PASS_FILE);
    process.exit(1);
}

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: password
};

const conn = new Client();

console.log('🚀 Connecting to remote server to wipe bikes...');

conn.on('ready', () => {
    console.log('✅ Connected. Uploading script...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        sftp.fastPut(LOCAL_SCRIPT, REMOTE_SCRIPT, (err) => {
            if (err) throw err;
            console.log('✅ Script uploaded. Executing...');
            
            const cmd = `cd /root/eubike/backend && node scripts/${SCRIPT_NAME}`;
            
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                
                stream.on('close', (code, signal) => {
                    console.log(`\n✅ Remote script finished with code ${code}`);
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
    console.error('❌ Connection error:', err);
}).connect(config);
