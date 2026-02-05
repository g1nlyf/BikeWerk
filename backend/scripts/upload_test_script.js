const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

const localPath = path.join(__dirname, 'test-fmv-refill.js');
const remotePath = '/root/eubike/backend/scripts/test-fmv-refill.js';

console.log(`Uploading ${localPath} to ${remotePath}...`);

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);
        
        writeStream.on('close', () => {
            console.log('✅ Upload complete!');
            conn.end();
        });
        
        readStream.pipe(writeStream);
    });
}).connect(config);