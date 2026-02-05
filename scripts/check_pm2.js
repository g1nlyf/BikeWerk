const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
  host: '45.9.41.232',
  username: 'root',
  password: '&9&%4q6631vI',
  readyTimeout: 20000
};

async function checkPM2() {
  try {
    console.log('Connecting to server...');
    await ssh.connect(config);
    console.log('Connected.');

    // 1. Check PM2 List
    console.log('\n--- Checking PM2 Status ---');
    const pm2List = await ssh.execCommand('pm2 list');
    console.log(pm2List.stdout);

    // 2. Check PM2 Logs for backend
    console.log('\n--- Checking PM2 Logs (eubike-backend) ---');
    // Get last 50 lines
    const pm2Logs = await ssh.execCommand('pm2 logs eubike-backend --lines 50 --nostream');
    console.log(pm2Logs.stdout);
    
    // Also check eubike-bot
    console.log('\n--- Checking PM2 Logs (eubike-bot) ---');
    const pm2LogsBot = await ssh.execCommand('pm2 logs eubike-bot --lines 20 --nostream');
    console.log(pm2LogsBot.stdout);

    ssh.dispose();

  } catch (error) {
    console.error('Diagnosis failed:', error);
    if (ssh.isConnected()) ssh.dispose();
  }
}

checkPM2();
