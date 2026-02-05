const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

conn.on('ready', () => {
    console.log('📦 Installing dependencies on Remote...');
    const cmd = `
        cd /root/eubike/backend
        echo "Running npm install..."
        npm install
        echo "Rebuilding better-sqlite3..."
        npm rebuild better-sqlite3
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Exec error:', err);
            conn.end();
            return;
        }
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        stream.on('close', () => {
            console.log('Install complete.');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('Connection Error:', err);
}).connect(config);
