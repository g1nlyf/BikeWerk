const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const ssh = new NodeSSH();

const config = {
  host: '45.9.41.232',
  username: 'root',
  readyTimeout: 20000
};

const passPath = path.join(__dirname, '../deploy_password.txt');
if (fs.existsSync(passPath)) {
    config.password = fs.readFileSync(passPath, 'utf8').trim();
}

async function run() {
  try {
    await ssh.connect(config);
    console.log('Connected.');
    console.log('Running manual hunt...');
    
    // Run the script and wait for result
    const cmd = 'cd /root/eubike/backend && node scripts/manual_hunt_remote.js';
    const result = await ssh.execCommand(cmd);
    console.log('STDOUT:', result.stdout);
    console.log('STDERR:', result.stderr);

    console.log('\nHunt finished. Checking DB...');
    
    // Check DB count again
    const dbPath = '/root/eubike/backend/database/eubike.db';
    const script = `
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('${dbPath}');
db.get('SELECT count(*) as c FROM bikes', (e,r) => console.log('Bikes:', e?e.message:r.c));
db.close();
`;
    const p = '/root/eubike/backend/db_check_final.js';
    await ssh.execCommand(`echo "${script.replace(/"/g, '\\"')}" > ${p}`);
    const res = await ssh.execCommand(`cd /root/eubike/backend && node ${p}`);
    console.log(res.stdout || res.stderr);

    ssh.dispose();
  } catch (error) {
    console.error('Failed:', error);
    if (ssh.isConnected()) ssh.dispose();
  }
}

run();
