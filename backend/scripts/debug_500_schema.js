const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Fetching Error Logs...');

conn.on('ready', () => {
    console.log('✅ Connected');
    
    // Fetch last 100 lines of error log to catch the 500 error stack trace
    // Also fetch the table info to check schema
    const cmd = `
        echo "=== PM2 ERROR LOGS (Last 100) ==="
        tail -n 100 /root/.pm2/logs/eubike-backend-error.log
        
        echo "\n=== REMOTE DB SCHEMA ==="
        cd /root/eubike/backend
        node -e "
            const Database = require('better-sqlite3');
            const db = new Database('database/eubike.db', { readonly: true });
            const cols = db.pragma('table_info(bikes)');
            console.table(cols);
        "
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('🎁 Done with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
