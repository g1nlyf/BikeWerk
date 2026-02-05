const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function debugRemote() {
    try {
        await ssh.connect(config);
        console.log('Connected.');

        // 1. Check PM2 Env
        console.log('--- PM2 Backend Info ---');
        const pm2Res = await ssh.execCommand('pm2 describe eubike-backend');
        console.log(pm2Res.stdout);

        // 2. Check DB file size and mod time
        console.log('--- DB Stats ---');
        const lsRes = await ssh.execCommand('ls -l /root/eubike/backend/database/eubike.db');
        console.log(lsRes.stdout);

        // 3. Count Bikes
        console.log('--- Bike Count ---');
        const countCmd = `
            cd /root/eubike/backend
            node -e "
                const db = require('better-sqlite3')('database/eubike.db');
                const count = db.prepare('SELECT count(*) as c FROM bikes').get();
                console.log('Bikes count:', count.c);
            "
        `;
        const countRes = await ssh.execCommand(countCmd);
        console.log(countRes.stdout || countRes.stderr);

    } catch (e) {
        console.error(e);
    } finally {
        ssh.dispose();
    }
}

debugRemote();
