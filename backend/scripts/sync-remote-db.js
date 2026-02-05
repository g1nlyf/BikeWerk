const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
// Try loading from backend/.env first, then root .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI',
    remoteDbPath: '/root/eubike/backend/database/eubike.db',
    localDbPath: path.join(__dirname, '../database/eubike.db')
};

function syncDb() {
    console.log(`🔄 [${new Date().toISOString()}] Starting one-time DB sync...`);
    const conn = new Client();
    
    conn.on('ready', () => {
        console.log('Connected via SSH.');
        conn.sftp((err, sftp) => {
            if (err) {
                console.error('❌ SFTP error:', err);
                conn.end();
                return;
            }

            console.log(`⬇️ Downloading ${config.remoteDbPath} to ${config.localDbPath}...`);
            
            sftp.fastGet(config.remoteDbPath, config.localDbPath, (err) => {
                if (err) {
                    console.error('❌ Download failed:', err);
                    process.exit(1);
                } else {
                    console.log('✅ Database downloaded successfully!');
                    conn.end();
                    process.exit(0);
                }
            });
        });
    }).on('error', (err) => {
        console.error('❌ Connection error:', err);
        process.exit(1);
    }).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password
    });
}

syncDb();
