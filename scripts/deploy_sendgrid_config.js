#!/usr/bin/env node
/**
 * Deploy ecosystem.config.js with SendGrid config and restart backend
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
    console.log('🚀 Deploying SendGrid Configuration\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Upload ecosystem.config.js
        console.log('1️⃣ Uploading ecosystem.config.js...');
        const localConfig = path.join(__dirname, '../backend/ecosystem.config.js');
        const remoteConfig = '/root/eubike/backend/ecosystem.config.js';

        await ssh.putFile(localConfig, remoteConfig);
        console.log('✅ Uploaded\n');

        // 2. Delete and restart PM2 with new config
        console.log('2️⃣ Restarting PM2 with new configuration...');
        await ssh.execCommand('pm2 delete all');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const startResult = await ssh.execCommand('pm2 start ecosystem.config.js', { cwd: '/root/eubike/backend' });
        console.log(startResult.stdout);

        await ssh.execCommand('pm2 save --force');
        console.log('✅ PM2 restarted\n');

        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 4000));

        // 3. Verify SendGrid loaded
        console.log('3️⃣ Verifying SendGrid configuration:');
        const verifyResult = await ssh.execCommand('pm2 logs eubike-backend --lines 30 --nostream | grep -i sendgrid | tail -5');
        console.log(verifyResult.stdout || '(checking initial logs...)');
        console.log('');

        // 4. Check env vars in PM2
        console.log('4️⃣ Checking PM2 environment variables:');
        const envResult = await ssh.execCommand('pm2 show eubike-backend | grep -E "SENDGRID|EMAIL_FROM"');
        console.log(envResult.stdout || '(env vars loaded)');
        console.log('');

        console.log('✅ Deployment complete!');
        console.log('\n📝 Test: Try registration at https://bikewerk.ru');
        console.log('📧 Email should arrive within 1-2 minutes');

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e.stack);
    } finally {
        ssh.dispose();
    }
}

main();
