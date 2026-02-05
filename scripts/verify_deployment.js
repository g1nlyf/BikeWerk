const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function verify() {
    try {
        console.log('🔍 Verifying deployment...');
        await ssh.connect(config);

        // 1. Check bot.js for /admin command
        console.log('Checking bot.js for /admin...');
        const botJs = await ssh.execCommand('grep "/admin" /root/eubike/telegram-bot/bot.js');
        if (botJs.stdout.includes('/admin')) {
            console.log('✅ bot.js contains /admin command.');
        } else {
            console.log('❌ bot.js DOES NOT contain /admin command!');
        }

        // 2. Check Nginx config for port 8082
        console.log('Checking Nginx config...');
        const nginxConf = await ssh.execCommand('cat /etc/nginx/sites-enabled/default');
        if (nginxConf.stdout.includes('8082')) {
            console.log('✅ Nginx is configured for port 8082.');
        } else {
            console.log('❌ Nginx is NOT configured for port 8082!');
            console.log(nginxConf.stdout);
        }

        // 3. Check DB for price_history table
        console.log('Checking DB for price_history...');
        // We can use sqlite3 command line if installed, or a node script.
        // Let's try a quick node one-liner on the server.
        const dbCheck = await ssh.execCommand(`
            cd /root/eubike/telegram-bot && 
            node -e "
                const sqlite3 = require('sqlite3');
                const db = new sqlite3.Database('../backend/database/eubike.db');
                db.all(\\\"SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'\\\", (err, rows) => {
                    if(err) console.log('Error:', err);
                    else console.log('Table found:', rows.length > 0 ? 'YES' : 'NO');
                });
            "
        `);
        console.log('DB Check Output:', dbCheck.stdout || dbCheck.stderr);

    } catch (e) {
        console.error('Verification failed:', e);
    } finally {
        ssh.dispose();
    }
}

verify();
