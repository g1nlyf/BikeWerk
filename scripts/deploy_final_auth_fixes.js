#!/usr/bin/env node
/**
 * Deploy final auth overlay fixes:
 * - New email design with code in subject
 * - Removed old AuthDialog component
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
    console.log('🚀 Deploying Final Auth Overlay Fixes\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Upload updated EmailService.js
        console.log('1️⃣ Uploading EmailService.js with new email design...');
        const localEmail = path.join(__dirname, '../backend/src/services/EmailService.js');
        const remoteEmail = '/root/eubike/backend/src/services/EmailService.js';

        await ssh.putFile(localEmail, remoteEmail);
        console.log('✅ Uploaded\n');

        // 2. Restart backend
        console.log('2️⃣ Restarting backend...');
        await ssh.execCommand('pm2 restart eubike-backend');
        console.log('✅ Backend restarted\n');

        console.log('✅ Deployment complete!');
        console.log('\n📧 Test: Register new account at https://bikewerk.ru');
        console.log('📝 Subject line will now show: "{CODE} — Ваш код подтверждения BikeWerk"');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
