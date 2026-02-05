#!/usr/bin/env node
/**
 * Check Auth Errors on Production Server
 */

const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🔍 Checking Auth Issues on Server\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Check recent backend logs for auth errors
        console.log('1️⃣ Recent auth errors in PM2 logs:');
        const authLogs = await ssh.execCommand('pm2 logs eubike-backend --lines 100 --nostream | grep -E "auth|register|send-code|400|429|error" | tail -30');
        console.log(authLogs.stdout || '(no auth errors)');
        console.log('');

        // 2. Check if SendGrid API key is set
        console.log('2️⃣ Checking SendGrid configuration:');
        const envCheck = await ssh.execCommand('cd /root/eubike/backend && grep SENDGRID .env 2>/dev/null || echo "SENDGRID not found in .env"');
        console.log(envCheck.stdout);
        console.log('');

        // 3. Check if new endpoints exist in server.js
        console.log('3️⃣ Checking if new endpoints are deployed:');
        const endpointCheck = await ssh.execCommand('cd /root/eubike/backend && grep -c "register-pending" server.js');
        console.log(`register-pending endpoint found: ${endpointCheck.stdout.trim() === '0' ? 'NO ❌' : 'YES ✅'}`);
        console.log('');

        // 4. Check recent email send attempts
        console.log('4️⃣ Recent email send attempts from system_logs:');
        const emailLogs = await ssh.execCommand('cd /root/eubike/backend && sqlite3 database/eubike.db "SELECT created_at, level, message FROM system_logs WHERE source = \'EmailService\' ORDER BY created_at DESC LIMIT 5" 2>&1 || echo "Cannot query DB"');
        console.log(emailLogs.stdout || emailLogs.stderr);
        console.log('');

        // 5. Test database connection
        console.log('5️⃣ Testing database connection:');
        const dbTest = await ssh.execCommand('cd /root/eubike/backend && sqlite3 database/eubike.db "SELECT COUNT(*) FROM users" 2>&1');
        console.log(`Users in DB: ${dbTest.stdout.trim()}`);
        console.log('');

        console.log('✅ Diagnostics complete');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
