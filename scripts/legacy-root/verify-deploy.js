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
    
    // Commands:
    // 1. Check disk usage (did we free up space?)
    // 2. Grep for the IP in the built frontend assets
    
    const cmd = `
        echo "=== Disk Usage ==="
        df -h /
        
        echo "\n=== Frontend Build Check ==="
        grep -r "45.9.41.232:8081" /root/eubike/frontend/dist/assets/ || echo "IP NOT FOUND in build assets"
        
        echo "\n=== Check for localhost ==="
        grep -r "localhost:8082" /root/eubike/frontend/dist/assets/ || echo "localhost:8082 NOT FOUND (Good)"
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
