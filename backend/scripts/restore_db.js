
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');
const LOCAL_DB_PATH = path.join(PROJECT_ROOT, 'backend/database/eubike.db');

// Config
const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    remotePath: '/root/eubike/backend/database/eubike.db'
};

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

async function uploadDB() {
    try {
        if (!fs.existsSync(LOCAL_DB_PATH)) {
            throw new Error(`Local DB not found at ${LOCAL_DB_PATH}`);
        }
        
        const stats = fs.statSync(LOCAL_DB_PATH);
        console.log(`📦 Local DB Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('✅ Connected. Uploading DB...');
            
            conn.sftp((err, sftp) => {
                if (err) throw err;
                
                const readStream = fs.createReadStream(LOCAL_DB_PATH);
                const writeStream = sftp.createWriteStream(config.remotePath);
                
                let uploaded = 0;
                readStream.on('data', (chunk) => {
                    uploaded += chunk.length;
                    process.stdout.write(`\r⬆️ Uploaded: ${(uploaded / 1024 / 1024).toFixed(2)} MB`);
                });
                
                writeStream.on('close', () => {
                    console.log('\n✅ DB Upload Complete!');
                    
                    // Restart Backend
                    console.log('🔄 Restarting Backend...');
                    conn.exec('pm2 restart eubike-backend', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', (code) => {
                            console.log(`Backend restarted (Exit code: ${code})`);
                            conn.end();
                        });
                    });
                });
                
                readStream.pipe(writeStream);
            });
        }).connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: password
        });

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

uploadDB();
