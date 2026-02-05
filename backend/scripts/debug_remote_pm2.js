const { Client } = require('ssh2');

const config = { 
    host: '45.9.41.232', 
    port: 22, 
    username: 'root', 
    password: '&9&%4q6631vI' 
};

const conn = new Client();

console.log('Connecting to remote server (debug script)...');

conn.on('ready', () => {
    console.log('Connected. Checking files...');
    
    // Check if files exist
    conn.exec('ls -la /root/eubike/backend/ecosystem.config.js /root/eubike/backend/cron/fill-fmv.js', (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log('File check finished with code ' + code);
            
            // Try uploading manually if missing (using echo since files are small-ish)
            // But ecosystem.config.js is multi-line.
            // Let's just try to start PM2 and see what happens.
            
            const cmd = 'cd /root/eubike/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save';
            console.log('Running: ' + cmd);
            
            conn.exec(cmd, (err, stream) => {
                stream.on('data', (d) => process.stdout.write(d));
                stream.on('close', () => conn.end());
            });
        }).on('data', (data) => {
            process.stdout.write(data);
        });
    });
    
}).connect(config);
