const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Starting FORCE Wipe & Restart Protocol...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    // Using a single command string to ensure atomicity and avoid round-trip freezes
    const cmd = `
        echo "=== 1. Killing Process ==="
        pm2 delete eubike-backend || echo "Process not found, continuing..."
        
        echo "=== 2. Deleting Database ==="
        rm -fv /root/eubike/backend/database/eubike.db
        
        echo "=== 3. Starting Fresh ==="
        cd /root/eubike/backend
        pm2 start ecosystem.config.js --update-env
        pm2 save
        
        echo "=== 4. Verification ==="
        sleep 5
        pm2 status eubike-backend
        ls -l /root/eubike/backend/database/eubike.db
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('🎁 Protocol Finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
