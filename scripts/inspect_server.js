const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike'
};

const ssh = new NodeSSH();

async function main() {
    console.log(chalk.blue('🔍 Inspecting Remote Server...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('Connected.');

        console.log(chalk.yellow('\n1. Checking PM2 Status:'));
        const pm2List = await ssh.execCommand('pm2 list');
        console.log(pm2List.stdout || pm2List.stderr);

        console.log(chalk.yellow('\n2. Checking Backend Logs (last 50 lines):'));
        const logs = await ssh.execCommand('pm2 logs eubike-backend --lines 50 --nostream');
        console.log(logs.stdout || logs.stderr);

        console.log(chalk.yellow('\n3. Checking Port 8082 (Backend):'));
        const portCheck = await ssh.execCommand('netstat -tuln | grep 8082');
        if (portCheck.stdout) {
            console.log(chalk.green('✅ Port 8082 is open:'));
            console.log(portCheck.stdout);
        } else {
            console.log(chalk.red('❌ Port 8082 is NOT listening. Backend is likely down or failing to start.'));
        }

        console.log(chalk.yellow('\n4. Checking Database File:'));
        const dbCheck = await ssh.execCommand(`ls -l ${config.remoteBase}/backend/database/eubike.db`);
        console.log(dbCheck.stdout || dbCheck.stderr);

    } catch (e) {
        console.error(chalk.red('Inspection failed:'), e);
    } finally {
        ssh.dispose();
    }
}

main();
