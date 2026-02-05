const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

console.log('🚀 Debugging Remote Script Execution...');

conn.on('ready', () => {
    const cmd = `
        cd /root/eubike/backend && \
        node scripts/test-fmv-refill.js 2>&1
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`\n✅ Finished with code ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        });
    });
}).connect(config);