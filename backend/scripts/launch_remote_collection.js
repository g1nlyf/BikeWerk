const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Launching Mass Collection on Remote...');
    const cmd = `
        mkdir -p /root/eubike/logs
        cd /root/eubike
        nohup node backend/scripts/mass-data-collection.js > logs/collection-$(date +%Y%m%d-%H%M%S).log 2>&1 &
        echo "Process launched with PID $!"
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Exec error:', err);
            conn.end();
            return;
        }
        stream.pipe(process.stdout);
        stream.on('close', () => {
            console.log('Launch command executed.');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection Error:', err);
}).connect(config);
