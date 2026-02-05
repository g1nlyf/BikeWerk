const { NodeSSH } = require('node-ssh');
const path = require('path');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
};

const ssh = new NodeSSH();

async function checkLogs() {
    try {
        console.log(chalk.blue('Connecting to server...'));
        await ssh.connect(config);
        
        console.log(chalk.cyan('--- Manager Bot Out Log ---'));
        const outLog = await ssh.execCommand('tail -n 20 /root/.pm2/logs/eubike-manager-bot-out.log');
        console.log(outLog.stdout);

    } catch (e) {
        console.error(chalk.red('Failed to check logs:'), e);
    } finally {
        ssh.dispose();
    }
}

checkLogs();
