const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = { 
    host: '45.9.41.232', 
    port: 22, 
    username: 'root', 
    password: '&9&%4q6631vI' 
};

const scriptPath = path.resolve(__dirname, 'hunt_fmv_only.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const conn = new Client();

console.log('Connecting to remote server...');

conn.on('ready', () => {
    console.log('Connected. Uploading script via cat...');
    
    // 1. Upload script via cat
    conn.exec('cat > /root/eubike/backend/scripts/hunt_fmv_only.js', (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log('Upload finished. Executing script...');
            
            // 2. Execute script
            // Added DEBUG=true just in case
            const cmd = 'cd /root/eubike/backend && node scripts/hunt_fmv_only.js';
            console.log('Running command:', cmd);
            
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                
                stream.on('close', (code, signal) => {
                    console.log('Remote script finished with code ' + code);
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT:', data.toString());
                }).stderr.on('data', (data) => {
                    console.log('STDERR:', data.toString());
                });
            });
        });
        
        // Write content to stdin of cat
        stream.write(scriptContent);
        stream.end();
    });
    
}).connect(config);
