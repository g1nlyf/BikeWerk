const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();
conn.on('ready', () => {
    console.log('Cleaning remote images...');
    conn.exec('rm -rf /root/eubike/backend/public/images/bikes/*', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Cleaned.');
            conn.end();
        });
    });
}).connect(config);
