const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');
const ora = require('ora');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike'
};

const ssh = new NodeSSH();

async function main() {
    try {
        await ssh.connect(config);
        console.log(chalk.green('Connected. Installing dependencies...'));

        const spinner = ora('Installing Backend dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/backend` });
        spinner.succeed('Backend dependencies installed');

        const botSpinner = ora('Installing Telegram Bot dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/telegram-bot` });
        botSpinner.succeed('Telegram Bot dependencies installed');

        const clientBotSpinner = ora('Installing Client Bot dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/client-telegram-bot` });
        clientBotSpinner.succeed('Client Bot dependencies installed');
        
        console.log(chalk.green('Restarting services...'));
        await ssh.execCommand('pm2 restart all');
        
        ssh.dispose();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();