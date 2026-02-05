#!/usr/bin/env node
/**
 * Deploy Fixed ecosystem.config.js and restart PM2
 */

const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🚀 Deploying Fixed Configuration\n');

    try {
        await ssh.connect(config); console.log('✅ Connected to server\n');

        // Upload the corrected ecosystem.config.js
        console.log('1️⃣ Uploading corrected ecosystem.config.js...');
        const localFile = path.join(__dirname, '../backend/ecosystem.config.js');
        const remoteFile = '/root/eubike/backend/ecosystem.config.js';

        await ssh.putFile(localFile, remoteFile);
        console.log('✅ Uploaded\n');

        // Delete and restart PM2
        console.log('2️⃣ Restarting PM2 with new config...');
        await ssh.execCommand('pm2 delete all');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const startResult = await ssh.execCommand('pm2 start ecosystem.config.js', { cwd: '/root/eubike/backend' });
        console.log(startResult.stdout);
        await ssh.execCommand('pm2 save --force');
        console.log('✅ Restarted\n');

        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify DB path
        console.log('3️⃣ Verifying database path in logs:');
        const logsResult = await ssh.execCommand('pm2 logs eubike-backend --lines 30 --nostream | grep -i "database\\|db path\\|using db"');
        console.log(logsResult.stdout || '(waiting for logs...)');
        console.log('');

        console.log('✅ Configuration deployed!');
        console.log('\n📝 Test: Open https://bikewerk.ru/catalog in browser');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
