const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Starting Emergency Wipe...');

conn.on('ready', () => {
    console.log('✅ Connected');
    // Stop, Delete, Start
    const cmd = 'pm2 stop eubike-backend && rm -f /root/eubike/backend/database/eubike.db && pm2 start eubike-backend';
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('✅ Wipe Command Finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect(config);
