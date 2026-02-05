const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

console.log('Connecting to remote server to check FMV (market_history) records...');

conn.on('ready', () => {
    const cmd = `
        cd /root/eubike/backend && node -e '
        const Database = require("better-sqlite3");
        try {
            const db = new Database("database/eubike.db", { readonly: true });
            
            // Check market_history count
            const mh = db.prepare("SELECT count(*) as c FROM market_history").get();
            console.log("📊 Market History Records (FMV Data): " + mh.c);
            
            // Check if hotness/salvage columns exist in bikes (just to verify schema update)
            const bikeSample = db.prepare("SELECT count(*) as c FROM bikes WHERE hotness_score IS NOT NULL").get();
            console.log("🔥 Bikes with Hotness Score: " + bikeSample.c);
            
        } catch (e) {
            console.error("Error querying DB:", e.message);
        }'
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);