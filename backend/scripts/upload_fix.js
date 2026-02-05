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

console.log('Script started.');

async function uploadFile(remotePath, localPath) {
    return new Promise((resolve, reject) => {
        const content = fs.readFileSync(localPath);
        const base64 = content.toString('base64');
        
        console.log(`Uploading ${localPath} (${content.length} bytes) to ${remotePath}...`);
        
        // Upload in chunks if too large, but these are small (<5KB)
        // echo "base64" | base64 -d > remotePath
        
        const cmd = `echo "${base64}" | base64 -d > ${remotePath}`;
        
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            
            let stderr = '';
            stream.on('close', (code, signal) => {
                if (code === 0) {
                    console.log(`✅ Uploaded ${path.basename(remotePath)}`);
                    resolve();
                } else {
                    reject(new Error(`Upload failed with code ${code}: ${stderr}`));
                }
            }).on('data', (d) => process.stdout.write(d)).stderr.on('data', (d) => stderr += d);
        });
    });
}

conn.on('ready', async () => {
    try {
        await uploadFile('/root/eubike/backend/ecosystem.config.js', path.resolve(__dirname, '../ecosystem.config.js'));
        await uploadFile('/root/eubike/backend/cron/fill-fmv.js', path.resolve(__dirname, '../cron/fill-fmv.js'));
        
        console.log('Files uploaded. Restarting PM2...');
        const cmd = 'cd /root/eubike/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save';
        
        conn.exec(cmd, (err, stream) => {
            if (err) throw err;
            stream.on('close', () => {
                console.log('PM2 restarted.');
                conn.end();
            }).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d));
        });
        
    } catch (e) {
        console.error('Error:', e);
        conn.end();
    }
}).connect(config);
