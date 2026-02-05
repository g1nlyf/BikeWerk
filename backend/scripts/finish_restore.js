const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const LOCAL_DB_PATH = path.resolve(__dirname, '../database/eubike.db');
const REMOTE_DB_PATH = '/root/eubike/backend/database/eubike.db';

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        console.log(`📤 Uploading ${LOCAL_DB_PATH} to ${REMOTE_DB_PATH}...`);
        
        sftp.fastPut(LOCAL_DB_PATH, REMOTE_DB_PATH, {
            step: (transferred, chunk, total) => {
                const percent = Math.round((transferred / total) * 100);
                process.stdout.write(`\rProgress: ${percent}% `);
            }
        }, (err) => {
            if (err) throw err;
            console.log('\n✅ Upload complete.');
            
            console.log('🚀 Starting remote backend...');
            conn.exec('pm2 start eubike-backend', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code) => {
                    console.log('✅ Remote backend started. Code:', code);
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                });
            });
        });
    });
}).connect(config);
