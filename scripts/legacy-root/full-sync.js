const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();
const localDbPath = path.join(__dirname, 'backend', 'database', 'eubike.db');

console.log('=== FULL SYNC: DB + Frontend ===\n');

const conn = new Client();

async function uploadFile(sftp, localPath, remotePath) {
    return new Promise((resolve, reject) => {
        console.log(`Uploading ${path.basename(localPath)}...`);
        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);
        
        writeStream.on('close', () => {
            console.log(`✅ Uploaded ${path.basename(localPath)}`);
            resolve();
        });
        writeStream.on('error', reject);
        readStream.pipe(writeStream);
    });
}

conn.on('ready', () => {
    console.log('✅ Connected to server\n');
    
    conn.sftp(async (err, sftp) => {
        if (err) {
            console.error('SFTP error:', err);
            conn.end();
            return;
        }
        
        try {
            // 1. Stop backend first
            console.log('1. Stopping backend...');
            await new Promise((resolve, reject) => {
                conn.exec('pm2 stop eubike-backend', (err, stream) => {
                    if (err) reject(err);
                    stream.on('close', resolve);
                    stream.on('data', d => process.stdout.write(d.toString()));
                });
            });
            console.log('✅ Backend stopped\n');
            
            // 2. Upload database
            console.log('2. Uploading database...');
            await uploadFile(sftp, localDbPath, '/root/eubike/backend/database/eubike.db');
            console.log('');
            
            // 3. Rebuild frontend locally and upload
            console.log('3. Checking local frontend build...');
            const localDistPath = path.join(__dirname, 'frontend', 'dist');
            const indexJsFiles = fs.readdirSync(path.join(localDistPath, 'assets')).filter(f => f.startsWith('index-') && f.endsWith('.js'));
            console.log(`Local JS: ${indexJsFiles[0]}`);
            
            // 4. Clear remote dist and upload fresh
            console.log('\n4. Clearing remote dist/assets...');
            await new Promise((resolve, reject) => {
                conn.exec('rm -rf /root/eubike/frontend/dist/assets/* && mkdir -p /root/eubike/frontend/dist/assets', (err, stream) => {
                    if (err) reject(err);
                    stream.on('close', resolve);
                });
            });
            console.log('✅ Remote assets cleared\n');
            
            // 5. Upload all assets
            console.log('5. Uploading frontend assets...');
            const assetsDir = path.join(localDistPath, 'assets');
            const assetFiles = fs.readdirSync(assetsDir);
            
            for (const file of assetFiles) {
                const localFile = path.join(assetsDir, file);
                const remoteFile = `/root/eubike/frontend/dist/assets/${file}`;
                await uploadFile(sftp, localFile, remoteFile);
            }
            
            // 6. Upload index.html
            console.log('\n6. Uploading index.html...');
            await uploadFile(sftp, path.join(localDistPath, 'index.html'), '/root/eubike/frontend/dist/index.html');
            
            // 7. Restart everything
            console.log('\n7. Restarting services...');
            await new Promise((resolve, reject) => {
                conn.exec(`
                    cd /root/eubike &&
                    pm2 restart eubike-backend &&
                    service nginx restart &&
                    sleep 2 &&
                    echo "" &&
                    echo "=== VERIFICATION ===" &&
                    echo "DB Bikes:" &&
                    node -e "const db=require('better-sqlite3')('./backend/database/eubike.db');console.log(db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);" &&
                    echo "" &&
                    echo "Frontend JS:" &&
                    ls /root/eubike/frontend/dist/assets/*.js &&
                    echo "" &&
                    pm2 list
                `, (err, stream) => {
                    if (err) reject(err);
                    stream.on('data', d => process.stdout.write(d.toString()));
                    stream.stderr.on('data', d => process.stderr.write(d.toString()));
                    stream.on('close', resolve);
                });
            });
            
            console.log('\n\n🎉 FULL SYNC COMPLETE!');
            console.log('Please hard refresh (Ctrl+Shift+R) the browser.');
            
        } catch (e) {
            console.error('Error:', e);
        } finally {
            sftp.end();
            conn.end();
        }
    });
}).on('error', err => {
    console.error('Connection error:', err.message);
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass,
    readyTimeout: 60000
});
