const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

console.log('🚀 Installing dependencies and running test...');

conn.on('ready', () => {
    // 1. Install cheerio explicitly (it might be missing if it was devDep and prune was run)
    // 2. Run the test script
    const cmd = `
        cd /root/eubike/backend && \
        npm install cheerio && \
        node scripts/test-fmv-refill.js
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`\n✅ Finished with code ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);