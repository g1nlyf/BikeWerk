const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const commands = [
    'echo "=== NGINX CONFIG ==="',
    'cat /etc/nginx/sites-enabled/default || cat /etc/nginx/nginx.conf',
    'echo "\n=== DIRECTORY CHECK (/var/www/html/case) ==="',
    'ls -la /var/www/html/case || echo "Directory not found"',
    'echo "\n=== BACKEND PORT CHECK ==="',
    'grep "PORT" /root/eubike/backend/.env',
    'echo "\n=== LISTENING PORTS ==="',
    'netstat -tuln | grep LISTEN'
];

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec(commands.join(' && '), (err, stream) => {
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
