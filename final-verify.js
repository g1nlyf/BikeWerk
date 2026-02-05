const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    
    // Check processes and verify build again
    const cmd = `
        echo "=== PM2 STATUS ==="
        pm2 status
        
        echo "\n=== VERIFYING BUILD ASSETS (FINAL CHECK) ==="
        echo "Looking for correct IP..."
        grep -r "45.9.41.232:8081" /root/eubike/frontend/dist/assets/ | head -n 1 && echo "✅ Correct IP found" || echo "❌ Correct IP NOT found"
        
        echo "Looking for localhost..."
        grep -r "localhost:8082" /root/eubike/frontend/dist/assets/ | head -n 1 && echo "❌ Localhost found!" || echo "✅ No localhost found (Clean build)"
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect(config);
