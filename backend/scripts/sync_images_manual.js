const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');
const LOCAL_IMAGES_DIR = path.join(PROJECT_ROOT, 'backend/public/images/bikes');
const REMOTE_IMAGES_DIR = '/root/eubike/backend/public/images/bikes';

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) throw new Error(`Password file not found: ${PASS_FILE}`);
    return fs.readFileSync(PASS_FILE, 'utf8').trim();
}

async function uploadDirectory(sftp, localDir, remoteDir) {
    // Ensure remote dir exists
    try {
        await new Promise((resolve, reject) => sftp.mkdir(remoteDir, (err) => {
            if (err && err.code !== 2) reject(err); // 2 = ENOENT, ignore if exists? No, mkdir fails if exists with code 4 usually.
            // Actually mkdir might fail if parent doesn't exist.
            // But let's assume parent exists or we handle it.
            // Better: just try to create.
            resolve();
        }));
    } catch (e) {
        // Ignore error if dir exists
    }

    const items = fs.readdirSync(localDir);
    for (const item of items) {
        const localPath = path.join(localDir, item);
        const remotePath = `${remoteDir}/${item}`;
        const stats = fs.statSync(localPath);

        if (stats.isDirectory()) {
            console.log(`   📁 Creating remote dir: ${remotePath}`);
            await uploadDirectory(sftp, localPath, remotePath);
        } else {
            console.log(`   ⬆️ Uploading ${item}...`);
            await new Promise((resolve, reject) => {
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }
}

async function syncImages() {
    console.log('🚀 Syncing Images to Remote...');
    const password = await readPassword();
    const conn = new Client();

    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            console.log('✅ SSH Connection established');
            conn.sftp(async (err, sftp) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }

                try {
                    // 1. Clean remote directory? Or just overwrite?
                    // "очисть все фотографии из вышеупомянутой дирекотрии" - user asked to clean locally.
                    // For remote, let's just sync (upload what we have).
                    // If we want to be clean, we could `rm -rf` via exec first.
                    
                    await uploadDirectory(sftp, LOCAL_IMAGES_DIR, REMOTE_IMAGES_DIR);
                    console.log('✅ Image Sync Complete');
                    conn.end();
                    resolve();
                } catch (e) {
                    console.error('Sync Error:', e);
                    conn.end();
                    reject(e);
                }
            });
        }).connect({
            host: '45.9.41.232',
            port: 22,
            username: 'root',
            password: password
        });
    });
}

syncImages().catch(console.error);
