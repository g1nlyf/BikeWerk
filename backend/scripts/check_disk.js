const { Client } = require('ssh2');

const config = { 
    host: '45.9.41.232', 
    port: 22, 
    username: 'root', 
    password: '&9&%4q6631vI' 
};

const conn = new Client();

console.log('Connecting...');

conn.on('ready', () => {
    console.log('Connected. Cleaning up disk...');
    
    // Delete large files
    conn.exec('rm -f "/root/eubike/EUBike Finals.rar" /root/eubike/deploy.tar.gz /root/eubike/deploy_delta.zip', (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log('Cleanup finished with code ' + code);
            
            // Check space again
            conn.exec('df -h', (err, stream) => {
                stream.on('data', d => process.stdout.write(d));
                stream.on('close', () => conn.end());
            });
        });
    });
    
}).connect(config);
