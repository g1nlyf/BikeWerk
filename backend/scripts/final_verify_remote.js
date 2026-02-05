const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Starting Final Verification...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    const cmd = `
        echo "=== 1. Check Process Status ==="
        pm2 status eubike-backend
        
        echo "\n=== 2. Check DB File Size ==="
        ls -lh /root/eubike/backend/database/eubike.db
        
        echo "\n=== 3. Check Internal API Health ==="
        curl -s http://localhost:8082/api/health || echo "❌ Health Check Failed"
        
        echo "\n=== 4. Check Catalog Count ==="
        # Simple SQL check using sqlite3 if available, or just node one-liner
        cd /root/eubike/backend
        node -e "const { DatabaseManager } = require('./src/js/mysql-config'); (async () => { const db = new DatabaseManager(); await db.initialize(); const r = await db.query('SELECT COUNT(*) as c FROM bikes'); console.log('Bikes in DB:', r[0].c); })()"
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
