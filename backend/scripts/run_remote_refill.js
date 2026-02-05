const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

console.log('🚀 Starting Remote FMV Refill Test...');

conn.on('ready', () => {
    const cmd = `
        cd /root/eubike/backend && \
        
        echo "--- INITIAL COUNT ---" && \
        node -e 'const db = new (require("better-sqlite3"))("database/eubike.db", {readonly: true}); console.log("Initial: " + db.prepare("SELECT count(*) as c FROM market_history").get().c);' && \
        
        echo "--- RUNNING REFILL ---" && \
        node scripts/test-fmv-refill.js && \
        
        echo "--- FINAL COUNT ---" && \
        node -e 'const db = new (require("better-sqlite3"))("database/eubike.db", {readonly: true}); console.log("Final: " + db.prepare("SELECT count(*) as c FROM market_history").get().c);'
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('\n✅ Remote execution finished.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);