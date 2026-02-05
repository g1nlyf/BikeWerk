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
    
    const cmd = `
        echo "=== Checking .env.production ==="
        ls -la /root/eubike/frontend/.env.production
        cat /root/eubike/frontend/.env.production
        
        echo "\n=== Checking current dir content ==="
        ls -la /root/eubike/frontend/
        
        echo "\n=== Trying to build manually with inline var ==="
        cd /root/eubike/frontend
        VITE_API_URL=http://45.9.41.232:8081/api npm run build
        
        echo "\n=== Grep again ==="
        grep -r "45.9.41.232:8081" /root/eubike/frontend/dist/assets/ || echo "Still not found"
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
