#!/usr/bin/env node
/**
 * Fix PM2 Configuration - Reload with correct DB_PATH
 */

const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🔧 Fixing PM2 Configuration\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        //1. Delete old PM2 processes
        console.log('1️⃣ Deleting old PM2 processes...');
        await ssh.execCommand('pm2 delete all');
        console.log('✅ Deleted\n');

        // 2. Start with new ecosystem.config.js from backend folder
        console.log('2️⃣ Starting PM2 with updated ecosystem.config.js...');
        const startResult = await ssh.execCommand('pm2 start ecosystem.config.js', { cwd: '/root/eubike/backend' });
        console.log(startResult.stdout);
        if (startResult.stderr) console.error(startResult.stderr);
        console.log('');

        // 3. Save PM2 configuration
        console.log('3️⃣ Saving PM2 configuration...');
        await ssh.execCommand('pm2 save --force');
        console.log('✅ Saved\n');

        // 4. Verify environment variables
        console.log('4️⃣ Verifying DB_PATH in PM2:');
        const verifyResult = await ssh.execCommand('pm2 show eubike-backend | grep -E "DB_PATH|cwd"');
        console.log(verifyResult.stdout);
        console.log('');

        // 5. Wait a bit for startup and check logs
        console.log('5️⃣ Checking startup logs...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const logsResult = await ssh.execCommand('pm2 logs eubike-backend --lines 20 --nostream | grep -i "database\\|db\\|using"');
        console.log(logsResult.stdout || '(no DB logs yet)');
        console.log('');

        console.log('✅ PM2 configuration updated!');
        console.log('\n📝 Next: Test API with curl https://bikewerk.ru/api/catalog/bikes?limit=5');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
