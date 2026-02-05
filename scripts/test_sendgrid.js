#!/usr/bin/env node
/**
 * Test SendGrid Email Sending
 */

const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🧪 Testing SendGrid Configuration\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Check current PM2 logs for SendGrid initialization
        console.log('1️⃣ Checking backend startup logs:');
        const startupLogs = await ssh.execCommand('pm2 logs eubike-backend --lines 50 --nostream 2>&1 | grep -v "^$" | tail -20');
        console.log(startupLogs.stdout);
        console.log('');

        // 2. Test if SendGrid warning still appears
        console.log('2️⃣ Looking for SendGrid warnings:');
        const warningCheck = await ssh.execCommand('pm2 logs eubike-backend --lines 100 --nostream | grep -i "sendgrid\\|email send"');
        console.log(warningCheck.stdout || '(no SendGrid warnings - good!)');
        console.log('');

        // 3. Try to trigger a test email by calling the endpoint
        console.log('3️⃣ Testing /api/auth/send-code endpoint via curl:');
        const testEmail = await ssh.execCommand('curl -X POST https://bikewerk.ru/api/auth/send-code -H "Content-Type: application/json" -d \'{"email":"test@test.com"}\' 2>&1');
        console.log('Response:', testEmail.stdout.substring(0, 500));
        console.log('');

        // 4. Check logs after API call
        console.log('4️⃣ Checking logs after API call:');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const afterLogs = await ssh.execCommand('pm2 logs eubike-backend --lines 30 --nostream 2>&1 | tail -15');
        console.log(afterLogs.stdout);
        console.log('');

        console.log('✅ Test complete');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
