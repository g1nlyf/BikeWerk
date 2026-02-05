const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = { 
    host: '45.9.41.232', 
    port: 22, 
    username: 'root', 
    password: '&9&%4q6631vI' 
};

const conn = new Client();

console.log('🔌 Connecting to remote server for DEBUG...');

conn.on('ready', () => {
    console.log('✅ Connected. Starting SFTP...');

    conn.sftp((err, sftp) => {
        if (err) throw err;

        const filesToUpload = [
            {
                local: path.join(__dirname, 'remote_debug_schema.js'),
                remote: '/root/eubike/backend/scripts/remote_debug_schema.js'
            }
        ];

        let uploadedCount = 0;

        filesToUpload.forEach(file => {
            sftp.fastPut(file.local, file.remote, (err) => {
                if (err) {
                    console.error(`❌ Failed to upload ${file.local}:`, err);
                    conn.end();
                    return;
                }
                console.log(`⬆️ Uploaded: ${path.basename(file.remote)}`);
                uploadedCount++;

                if (uploadedCount === filesToUpload.length) {
                    console.log('✅ All files uploaded. Executing Debug Script...');
                    executeDebugScript();
                }
            });
        });
    });

    function executeDebugScript() {
        const cmd = 'cd /root/eubike/backend && node scripts/remote_debug_schema.js';
        
        conn.exec(cmd, (err, stream) => {
            if (err) throw err;
            
            stream.on('close', (code, signal) => {
                console.log('Debug execution finished with code ' + code);
                conn.end();
            }).on('data', (data) => {
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                process.stderr.write(data);
            });
        });
    }
    
}).connect(config);
