const { Client } = require('ssh2');

const config = { 
    host: '45.9.41.232', 
    port: 22, 
    username: 'root', 
    password: '&9&%4q6631vI' 
};

const conn = new Client();

console.log('🔌 Connecting to remote server to read Nginx config...');

conn.on('ready', () => {
    console.log('✅ Connected. Reading default site config...');
    
    // Read the default site config
    const cmd = 'cat /etc/nginx/sites-available/default';
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log('Read finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
    
}).connect(config);
