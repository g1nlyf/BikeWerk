#!/usr/bin/env node
/**
 * Deploy .env file and restart backend
 */

const { NodeSSH } = require('node-ssh');
const path = require('path');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🚀 Deploying .env Fix\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Upload .env file
        console.log('1️⃣ Uploading backend/.env...');
        const localEnv = path.join(__dirname, '../backend/.env');
        const remoteEnv = '/root/eubike/backend/.env';

        await ssh.putFile(localEnv, remoteEnv);
        console.log('✅ .env uploaded\n');

        // 2. Restart backend PM2 process
        console.log('2️⃣ Restarting eubike-backend...');
        const restartResult = await ssh.execCommand('pm2 restart eubike-backend');
        console.log(restartResult.stdout);
        console.log('✅ Backend restarted\n');

        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Verify SendGrid config loaded
        console.log('3️⃣ Verifying SendGrid config:');
        const verifyResult = await ssh.execCommand('pm2 logs eubike-backend --lines 20 --nostream | grep -E "SENDGRID|SendGrid|Email" | tail -5');
        console.log(verifyResult.stdout || '(no SendGrid logs yet)');
        console.log('');

        console.log('✅ Deployment complete!');
        console.log('\n📝 Next: Test registration at https://bikewerk.ru');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
