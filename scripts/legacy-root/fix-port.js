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
    // 1. Change PORT to 8081 in .env
    // 2. Restart backend
    // 3. Check logs to confirm port
    
    const cmd = `
        echo "Updating .env..."
        sed -i 's/PORT=8082/PORT=8081/' /root/eubike/backend/.env
        
        echo "Restarting backend..."
        pm2 restart eubike-backend
        
        echo "Waiting for startup..."
        sleep 5
        
        echo "Checking logs..."
        pm2 logs eubike-backend --lines 10 --nostream
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
