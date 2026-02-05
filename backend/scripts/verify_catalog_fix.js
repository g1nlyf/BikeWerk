const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Final Catalog Verification...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    const cmd = `
        echo "=== 1. API Health ==="
        curl -s http://localhost:8082/api/health
        
        echo "\n\n=== 2. Catalog Endpoint Test ==="
        curl -v "http://localhost:8082/api/bikes?limit=5&offset=0" 2>&1 | head -n 20
        
        echo "\n\n=== 3. Check for New Errors ==="
        tail -n 20 /root/.pm2/logs/eubike-backend-error.log
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('🎁 Verification Done with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
