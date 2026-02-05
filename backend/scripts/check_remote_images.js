const { Client } = require('ssh2');

const config = { 
    host: '45.9.41.232', 
    port: 22, 
    username: 'root', 
    password: '&9&%4q6631vI' 
};

const conn = new Client();

console.log('🔌 Connecting to remote server to check images...');

conn.on('ready', () => {
    console.log('✅ Connected. Checking image directory...');
    
    // Check if directory exists and list first few items
    const cmd = 'ls -R /root/eubike/backend/public/images/bikes | head -n 20';
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log('Check finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
    
}).connect(config);
