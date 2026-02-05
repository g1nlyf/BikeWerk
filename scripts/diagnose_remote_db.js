#!/usr/bin/env node
/**
 * Remote Database Diagnostic Script
 * Checks which database file the backend is actually using
 */

const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🔍 Remote Database Diagnostic\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Check PM2 environment variables
        console.log('1️⃣ Checking PM2 environment for eubike-backend:');
        const envCheck = await ssh.execCommand('pm2 show eubike-backend | grep -A 20 "env:"');
        console.log(envCheck.stdout || envCheck.stderr);
        console.log('');

        // 2. Check all eubike.db files on server
        console.log('2️⃣ Finding all eubike.db files:');
        const findDb = await ssh.execCommand('find /root -name "eubike.db" -type f -exec ls -lh {} \\; 2>/dev/null');
        console.log(findDb.stdout);
        console.log('');

        // 3. Count bikes in the main database
        console.log('3️⃣ Counting bikes in /root/eubike/backend/database/eubike.db:');
        const countBikes = await ssh.execCommand('cd /root/eubike/backend && sqlite3 database/eubike.db "SELECT COUNT(*) FROM bikes;" 2>&1');
        console.log('Total bikes:', countBikes.stdout.trim());

        if (countBikes.stdout.trim() !== '0') {
            const sampleBikes = await ssh.execCommand('cd /root/eubike/backend && sqlite3 database/eubike.db "SELECT id, name, is_active FROM bikes LIMIT 5;" 2>&1');
            console.log('Sample bikes:\n', sampleBikes.stdout);
        }
        console.log('');

        // 4. Check process.cwd() for PM2 process
        console.log('4️⃣ Checking working directory of eubike-backend:');
        const cwdCheck = await ssh.execCommand('pm2 show eubike-backend | grep "cwd"');
        console.log(cwdCheck.stdout);
        console.log('');

        // 5. Check backend logs for database path
        console.log('5️⃣ Checking recent backend logs for DB path:');
        const logsCheck = await ssh.execCommand('pm2 logs eubike-backend --lines 50 --nostream 2>&1 | grep -i "database\\|db_path\\|using db" | tail -10');
        console.log(logsCheck.stdout || '(no DB path logs found)');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
