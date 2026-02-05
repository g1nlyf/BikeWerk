const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');
const LOCAL_DB = path.join(PROJECT_ROOT, 'backend/database/eubike.db');
const REMOTE_DB_PATH = '/root/eubike/backend/database/eubike.db';

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

async function uploadDB() {
    console.log('🚀 Uploading Local DB to Remote...');

    if (!fs.existsSync(LOCAL_DB)) {
        throw new Error(`Local DB not found: ${LOCAL_DB}`);
    }

    const password = await readPassword();
    const conn = new Client();

    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            console.log('✅ SSH Connection established');

            conn.sftp((err, sftp) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }

                console.log(`⬆️ Uploading ${LOCAL_DB} -> ${REMOTE_DB_PATH}...`);
                const readStream = fs.createReadStream(LOCAL_DB);
                const writeStream = sftp.createWriteStream(REMOTE_DB_PATH);

                writeStream.on('close', () => {
                    console.log(`✅ DB Upload Complete -> ${REMOTE_DB_PATH}`);
                    conn.end();
                    resolve();
                });

                writeStream.on('error', (e) => {
                    console.error('Upload Error:', e);
                    conn.end();
                    reject(e);
                });

                readStream.pipe(writeStream);
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

uploadDB().catch(console.error);