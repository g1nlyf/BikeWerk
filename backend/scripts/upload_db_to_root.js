const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');
const LOCAL_DB = path.join(PROJECT_ROOT, 'backend/database/eubike.db');
const REMOTE_DB_PATH = '/root/eubike/backend/database/eubike.db';

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

            // Ensure directory exists
            conn.exec('mkdir -p /root/eubike/backend/database', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {

                    conn.sftp((err, sftp) => {
                        if (err) throw err;

                        console.log(`⬆️ Uploading DB (${LOCAL_DB} -> ${REMOTE_DB_PATH})...`);
                        sftp.fastPut(LOCAL_DB, REMOTE_DB_PATH, (err) => {
                            if (err) throw err;
                            console.log('✅ DB Upload complete');

                            // Restart PM2
                            console.log('🔄 Restarting Backend...');
                            conn.exec('pm2 restart eubike-backend', (err, stream) => {
                                if (err) throw err;
                                stream.on('close', (code) => {
                                    console.log(`PM2 restart finished with code ${code}`);
                                    conn.end();
                                });
                            });
                        });
                    });
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
