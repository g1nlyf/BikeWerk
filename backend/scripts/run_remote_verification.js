const { Client } = require('ssh2');

// Config
const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

console.log('🚀 Running Remote Verification...');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');
    
    const cmd = `
        cd /root/eubike/backend && \
        node scripts/verify_sprint_final.js && \
        echo "--- HUNTER LOGS ---" && \
        pm2 logs hourly-hunter --lines 20 --nostream
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log(`\nDone (Exit: ${code})`);
            conn.end();
        }).on('data', (data) => process.stdout.write(data));
    });
}).connect(config);
