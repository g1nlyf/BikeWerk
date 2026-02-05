const { Client } = require('ssh2');

// Config
const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

console.log('🚑 STARTING REMOTE DB REPAIR...');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');
    
    const cmd = `
        cd /root/eubike/backend/database && \
        echo "1. Stopping services..." && \
        pm2 stop all && \
        echo "2. Backing up DB..." && \
        cp eubike.db eubike.db.bak.malformed && \
        echo "3. Attempting Dump & Restore..." && \
        echo '.dump' | sqlite3 eubike.db > dump.sql && \
        mv eubike.db eubike.db.old && \
        sqlite3 eubike.db < dump.sql && \
        echo "4. Verifying..." && \
        sqlite3 eubike.db "PRAGMA integrity_check;" && \
        echo "5. Restarting services..." && \
        pm2 restart all && \
        echo "✅ REPAIR COMPLETE"
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log(`\nDone (Exit: ${code})`);
            conn.end();
        }).on('data', (data) => process.stdout.write(data)).stderr.on('data', (data) => process.stderr.write(data));
    });
}).connect(config);
