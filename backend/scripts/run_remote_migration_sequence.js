const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// Config
const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI' // Using the password from debug_remote_run.js
};

console.log('🚀 Starting Remote Migration Sequence...');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected to remote server');
    
    // Command sequence
    const cmd = `
        cd /root/eubike/backend && \
        echo "--- STEP 1: MIGRATION ---" && \
        node scripts/migrate_old_data.js && \
        echo "--- STEP 2: VERIFICATION ---" && \
        node scripts/verify_sprint_final.js && \
        echo "--- STEP 3: RESTART HUNTER ---" && \
        pm2 restart hourly-hunter && \
        echo "--- STEP 3.1: CHECK LOGS ---" && \
        pm2 logs hourly-hunter --lines 20 --nostream
    `;
    
    console.log('Running remote commands...');
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('❌ Exec error:', err);
            conn.end();
            return;
        }
        
        stream.on('close', (code, signal) => {
            console.log(`\n✅ Remote execution finished with code ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
}).connect(config);
