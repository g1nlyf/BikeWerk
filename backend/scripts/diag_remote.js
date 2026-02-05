const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const PASS_FILE = path.resolve(__dirname, '../../deploy_password.txt');
const password = fs.readFileSync(PASS_FILE, 'utf8').trim();
const ssh = new NodeSSH();

async function run() {
    await ssh.connect({ host: '45.9.41.232', username: 'root', password });
    console.log('--- PM2 DESCRIBE 182 ---');
    // Use json output for easier parsing if needed, but text is fine for humans
    const res = await ssh.execCommand('pm2 describe 182');
    console.log(res.stdout);
    ssh.dispose();
}
run();
