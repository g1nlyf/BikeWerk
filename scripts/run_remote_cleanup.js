const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike',
    localCleanupFile: path.resolve(__dirname, '../cleanup-catalog.js'),
    localDbFile: path.resolve(__dirname, '../backend/database/eubike.db')
};

async function main() {
    console.log('🔌 Connecting to server...');
    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password
        });
        console.log('✅ Connected.');

        // 1. Stop Services
        console.log('🛑 Stopping services to unlock DB...');
        await ssh.execCommand('pm2 stop all');

        // 2. Upload Healthy DB
        console.log('🗑️ Removing old DB files (including WAL/SHM)...');
        await ssh.execCommand('rm -f backend/database/eubike.db backend/database/eubike.db-wal backend/database/eubike.db-shm', { cwd: config.remoteBase });

        console.log('📤 Uploading healthy eubike.db...');
        await ssh.putFile(config.localDbFile, `${config.remoteBase}/backend/database/eubike.db`);
        console.log('✅ DB Uploaded.');

        // 3. Upload Cleanup Script
        console.log('📤 Uploading cleanup-catalog.js...');
        await ssh.putFile(config.localCleanupFile, `${config.remoteBase}/cleanup-catalog.js`);
        console.log('✅ Script Uploaded.');

        // 4. Run Cleanup
        console.log('🧹 Running cleanup-catalog.js on server...');
        const { stdout, stderr } = await ssh.execCommand('node cleanup-catalog.js', { cwd: config.remoteBase });
        
        console.log('--- STDOUT ---');
        console.log(stdout);
        console.log('--- STDERR ---');
        if (stderr) console.error(stderr);

        // 5. Restart Services
        console.log('▶️ Restarting services...');
        await ssh.execCommand('pm2 restart all');
        console.log('✅ Services restarted.');

        ssh.dispose();
    } catch (e) {
        console.error('❌ Error:', e);
        // Try to restart services even if failed
        try {
             await ssh.execCommand('pm2 restart all');
        } catch (err) {}
        process.exit(1);
    }
}

main();
