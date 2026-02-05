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
        echo "=== backend/.env content ==="
        cat /root/eubike/backend/.env || echo "No .env file"
        
        echo "\n=== PM2 Process Env ==="
        pm2 env 0 | grep PORT
        
        echo "\n=== Check for ALTER TABLE in server.js ==="
        grep -n "ALTER TABLE applications ADD COLUMN preferred_contact" /root/eubike/backend/API/server.js
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
