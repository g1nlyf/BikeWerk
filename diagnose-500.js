const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const commands = [
    // Check PM2 logs for the backend process
    'echo "=== PM2 LOGS (LAST 100 LINES) ==="',
    'pm2 logs eubike-backend --lines 100 --nostream',
    
    // Check if the database file exists (if using SQLite)
    'echo "\n=== DATABASE FILE CHECK ==="',
    'ls -la /root/eubike/backend/Databases/eubike.db || echo "Database file not found"',
    
    // Check environment variables (safely, excluding sensitive info if possible, but we need to see if DB vars are set)
    'echo "\n=== ENV VARS CHECK ==="',
    'cat /root/eubike/backend/.env'
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
