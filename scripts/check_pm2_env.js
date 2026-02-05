const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const ssh = new NodeSSH();

const config = {
  host: '45.9.41.232',
  username: 'root',
  privateKey: fs.readFileSync('c:/Users/hacke/.ssh/id_rsa', 'utf8') // Assuming key auth or use password
};

// Use password from file
const passPath = path.join(__dirname, '../deploy_password.txt');
if (fs.existsSync(passPath)) {
    config.password = fs.readFileSync(passPath, 'utf8').trim();
    delete config.privateKey;
}

async function check() {
  try {
    await ssh.connect(config);
    console.log('Connected.');

    console.log('\n--- PM2 List ---');
    const list = await ssh.execCommand('pm2 list');
    console.log(list.stdout);

    console.log('\n--- Backend Env (182) ---');
    const backendEnv = await ssh.execCommand('pm2 env 182');
    console.log(backendEnv.stdout);

    console.log('\n--- Bot/Hunter Env (183) ---');
    const botEnv = await ssh.execCommand('pm2 env 183');
    console.log(botEnv.stdout);
    
    // Also check for other DB files
    console.log('\n--- Searching for .db files ---');
    const findDb = await ssh.execCommand('find /root/eubike -name "*.db"');
    console.log(findDb.stdout);

    ssh.dispose();
  } catch (e) {
    console.error(e);
  }
}

check();
