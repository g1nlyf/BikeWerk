const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Starting Path Verification...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    const cmd = `
        echo "=== 1. Check Images Directory ==="
        ls -ld /root/eubike/backend/public/images
        
        echo "=== 2. Check Database Path ==="
        ls -l /root/eubike/backend/database/eubike.db
        
        echo "=== 3. Check Config (mysql-config.js) ==="
        grep "DB_PATH" /root/eubike/backend/src/js/mysql-config.js || echo "DB_PATH not found in mysql-config.js"
        
        echo "=== 4. Check Ecosystem Config ==="
        cat /root/eubike/backend/ecosystem.config.js
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('🎁 Verification Finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
