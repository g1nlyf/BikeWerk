const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
  host: '45.9.41.232',
  username: 'root',
  password: '&9&%4q6631vI',
  readyTimeout: 20000
};

async function diagnose() {
  try {
    console.log('Connecting to server...');
    await ssh.connect(config);
    console.log('Connected.');

    // Check DB locations
    console.log('\n--- Checking DB Locations ---');
    const findDb = await ssh.execCommand('find /root/eubike -name "*.db"');
    console.log('DB Files found:\n', findDb.stdout);

    console.log('\n--- Checking PM2 Env for DB_PATH ---');
    const pm2Backend = await ssh.execCommand('pm2 env 182 | grep DB_PATH');
    console.log('Backend (182) DB_PATH:', pm2Backend.stdout || 'Not set (using default)');
    
    const pm2Bot = await ssh.execCommand('pm2 env 183 | grep DB_PATH');
    console.log('Bot (183) DB_PATH:', pm2Bot.stdout || 'Not set (using default)');

    const pm2BackendCwd = await ssh.execCommand('pm2 env 182 | grep PWD');
    console.log('Backend (182) CWD:', pm2BackendCwd.stdout);

    const pm2BotCwd = await ssh.execCommand('pm2 env 183 | grep PWD');
    console.log('Bot (183) CWD:', pm2BotCwd.stdout);

    // Check content of found DBs
    const dbs = findDb.stdout.split('\n').filter(l => l.trim().endsWith('.db'));
    for (const d of dbs) {
        if (!d.trim()) continue;
        console.log(`\nChecking ${d.trim()}...`);
        const script = `
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('${d.trim()}');
db.get('SELECT count(*) as c FROM bikes', (e,r) => console.log('Bikes:', e?e.message:r.c));
db.close();
`;
        const p = '/root/eubike/backend/db_check_temp.js';
        await ssh.execCommand(`echo "${script.replace(/"/g, '\\"')}" > ${p}`);
        const res = await ssh.execCommand(`cd /root/eubike/backend && node ${p}`);
        console.log(res.stdout || res.stderr);
    }

    // Check Nginx Config
    console.log('\n--- Checking Nginx Config ---');
    const nginxConf = await ssh.execCommand('cat /etc/nginx/sites-enabled/default'); // Or standard location
    console.log(nginxConf.stdout || nginxConf.stderr);
    
    // Check Nginx Logs for /api/bikes again
    console.log('\n--- Checking Nginx Logs for /api/bikes ---');

    ssh.dispose();
  } catch (error) {
    console.error('Diagnosis failed:', error);
    if (ssh.isConnected()) ssh.dispose();
  }
}

diagnose();
