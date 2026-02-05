const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

conn.on('ready', () => {
    console.log('📊 Remote Collection Status');
    const cmd = `
        cd /root/eubike/backend
        
        echo "--- Database Stats ---"
        node -e 'const Database = require("better-sqlite3"); const db = new Database("database/eubike.db"); console.log("Market History:", db.prepare("SELECT COUNT(*) as c FROM market_history").get().c); console.log("Catalog (Bikes):", db.prepare("SELECT COUNT(*) as c FROM bikes").get().c);'
        
        echo "--- Logs (Last 10 lines) ---"
        ls -t /root/eubike/logs/collection-*.log | head -1 | xargs tail -n 10 2>/dev/null || echo "No log file found"
        
        echo "--- Process ---"
        ps aux | grep mass-data-collection | grep -v grep || echo "Process NOT running"
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Exec error:', err);
            conn.end();
            return;
        }
        stream.pipe(process.stdout);
        stream.on('close', () => conn.end());
    });
}).on('error', (err) => {
    console.error('Connection Error:', err);
}).connect(config);
