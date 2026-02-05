const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();
conn.on('ready', () => {
    const cmd = `
        echo "--- DB Check ---"
        cd /root/eubike/backend && node -e 'const sqlite3 = require("sqlite3").verbose(); const db = new sqlite3.Database("database/eubike.db"); db.get("SELECT count(*) as c FROM bikes", (err, row) => { console.log(row ? row.c : "Error"); });'
        
        echo "--- Images Check ---"
        ls -1 /root/eubike/backend/public/images/bikes/ | wc -l
        
        echo "--- PM2 Status ---"
        if pm2 describe hourly-hunter > /dev/null 2>&1; then
            echo "✅ hourly-hunter is active"
        else
            echo "⚠️ hourly-hunter MISSING."
        fi
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        stream.on('close', () => conn.end());
    });
}).connect(config);
