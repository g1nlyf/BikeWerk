const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();
const frontendDist = path.join(__dirname, 'frontend', 'dist');
const zipPath = path.join(__dirname, 'frontend-dist.zip');

console.log('=== UPLOADING FRONTEND ===\n');

// Create zip of frontend/dist
console.log('1. Creating zip of frontend/dist...');
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);
archive.directory(frontendDist, false);

output.on('close', () => {
    console.log(`✅ Zip created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB\n`);
    
    // Upload
    const conn = new Client();
    conn.on('ready', () => {
        console.log('2. Connected to server');
        
        conn.sftp((err, sftp) => {
            if (err) {
                console.error('SFTP error:', err);
                conn.end();
                return;
            }
            
            console.log('3. Uploading zip...');
            const readStream = fs.createReadStream(zipPath);
            const writeStream = sftp.createWriteStream('/tmp/frontend-dist.zip');
            
            let uploaded = 0;
            const total = fs.statSync(zipPath).size;
            
            readStream.on('data', chunk => {
                uploaded += chunk.length;
                const pct = Math.round(uploaded / total * 100);
                process.stdout.write(`\r   Progress: ${pct}% (${(uploaded/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB)`);
            });
            
            writeStream.on('close', () => {
                console.log('\n✅ Upload complete\n');
                sftp.end();
                
                // Extract and restart
                console.log('4. Extracting on server and restarting...');
                conn.exec(`
                    rm -rf /root/eubike/frontend/dist &&
                    mkdir -p /root/eubike/frontend/dist &&
                    cd /root/eubike/frontend/dist &&
                    unzip -o /tmp/frontend-dist.zip &&
                    rm /tmp/frontend-dist.zip &&
                    echo "" &&
                    echo "=== Frontend files ===" &&
                    ls -la /root/eubike/frontend/dist/ | head -10 &&
                    ls -la /root/eubike/frontend/dist/assets/ | head -10 &&
                    echo "" &&
                    echo "=== Restarting ===" &&
                    cd /root/eubike &&
                    pm2 restart eubike-backend &&
                    service nginx restart &&
                    sleep 2 &&
                    echo "" &&
                    echo "=== API Test ===" &&
                    curl -s "http://localhost:8082/api/catalog/bikes?limit=1" | head -c 300 &&
                    echo "" &&
                    echo "" &&
                    pm2 list
                `, (err, stream) => {
                    if (err) {
                        console.error('Exec error:', err);
                        conn.end();
                        return;
                    }
                    stream.on('data', d => process.stdout.write(d.toString()));
                    stream.stderr.on('data', d => process.stderr.write(d.toString()));
                    stream.on('close', () => {
                        console.log('\n\n🎉 FRONTEND DEPLOYED!');
                        console.log('Please hard refresh (Ctrl+Shift+R) the browser.');
                        fs.unlinkSync(zipPath);
                        conn.end();
                    });
                });
            });
            
            writeStream.on('error', err => {
                console.error('Write error:', err);
            });
            
            readStream.pipe(writeStream);
        });
    }).on('error', err => {
        console.error('Connection error:', err.message);
    }).connect({
        host: '45.9.41.232',
        port: 22,
        username: 'root',
        password: pass,
        readyTimeout: 120000
    });
});

archive.on('error', err => {
    console.error('Archive error:', err);
});

archive.finalize();
