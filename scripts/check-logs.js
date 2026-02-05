const { NodeSSH } = require('node-ssh');
const path = require('path');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function checkLogs() {
    console.log(chalk.blue('🕵️ Checking Manager Bot Logs on Remote...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        
        const result = await ssh.execCommand('pm2 logs eubike-manager-bot --lines 50 --nostream');
        console.log(chalk.green('✅ Logs Retrieved:'));
        console.log(result.stdout);
        if (result.stderr) console.error(chalk.red('STDERR:'), result.stderr);

    } catch (e) {
        console.error(chalk.red('Failed to check logs:'), e);
    } finally {
        ssh.dispose();
    }
}

checkLogs();
