const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function debug() {
    try {
        console.log('🔍 Debugging Server Status...');
        await ssh.connect(config);

        // 1. PM2 List
        console.log('\n📊 PM2 Process List:');
        const pm2List = await ssh.execCommand('pm2 list');
        console.log(pm2List.stdout);

        // 2. Backend Logs
        console.log('\n📜 Backend Logs (last 20 lines):');
        const backendLogs = await ssh.execCommand('pm2 logs backend --lines 20 --nostream');
        console.log(backendLogs.stdout);

        // 3. Bot Logs
        console.log('\n🤖 Bot Logs (last 20 lines):');
        const botLogs = await ssh.execCommand('pm2 logs telegram-bot --lines 20 --nostream');
        console.log(botLogs.stdout);

        // 4. Force DB Init
        console.log('\n🛠️ Forcing DB Initialization...');
        const forceInit = await ssh.execCommand(`
            cd /root/eubike/telegram-bot && 
            node -e "
                const BikesDatabase = require('./bikes-database-node');
                const db = new BikesDatabase();
                db.ensureInitialized().then(() => {
                    console.log('✅ DB Initialized & Migrations Run');
                }).catch(err => {
                    console.error('❌ Init Failed:', err);
                });
            "
        `);
        console.log(forceInit.stdout);
        console.log(forceInit.stderr);

    } catch (e) {
        console.error('Debug failed:', e);
    } finally {
        ssh.dispose();
    }
}

debug();
