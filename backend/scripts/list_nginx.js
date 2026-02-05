const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

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

console.log('🚀 Listing Nginx sites...');

conn.on('ready', () => {
    // List files
    conn.exec('ls -la /etc/nginx/sites-enabled/', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`\n✅ Finished listing with code ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
}).connect(config);
