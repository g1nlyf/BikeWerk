const { Client } = require('ssh2');

const config = { 
    host: '45.9.41.232', 
    port: 22, 
    username: 'root', 
    password: '&9&%4q6631vI' 
};

const conn = new Client();

console.log('Connecting to remote server...');

conn.on('ready', () => {
    console.log('Connected. Debugging file existence...');
    
    const cmd = 'ls -la /root/eubike/backend/ecosystem.config.js /root/eubike/backend/cron/fill-fmv.js && echo "---" && ls -la /root/eubike/backend/';
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log('Debug finished with code ' + code);
            if (code === 0) {
                // If files exist, try starting PM2
                console.log('Files exist. Starting PM2...');
                conn.exec('cd /root/eubike/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save', (err, stream) => {
                     stream.on('data', (d) => process.stdout.write(d));
                     stream.on('close', () => conn.end());
                });
            } else {
                conn.end();
            }
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
    
}).connect(config);
