const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

conn.on('ready', () => {
    conn.exec('ls -la /root/eubike/backend/scripts/', (err, stream) => {
        if (err) throw err;
        stream.pipe(process.stdout);
        stream.on('close', () => conn.end());
    });
}).connect(config);