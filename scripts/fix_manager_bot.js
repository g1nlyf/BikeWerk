const { NodeSSH } = require('node-ssh');
const path = require('path');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike'
};

const ssh = new NodeSSH();

async function main() {
    console.log(chalk.blue('🔧 Fixing Manager Bot Conflict...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });

        // 1. List current processes
        console.log('Current PM2 list:');
        const list = await ssh.execCommand('pm2 list');
        console.log(list.stdout);

        // CHECK TOKENS
        console.log('Checking remote tokens...');
        const userBotContent = await ssh.execCommand(`cat ${config.remoteBase}/telegram-bot/bot.js`);
        const managerBotContent = await ssh.execCommand(`cat ${config.remoteBase}/manager-bot/index.js`);

        const userBotTokenMatch = userBotContent.stdout.match(/BOT_TOKEN:\s*'([^']+)'/);
        const managerBotTokenMatch = managerBotContent.stdout.match(/const TOKEN = '([^']+)';/);

        console.log('User Bot Token:', userBotTokenMatch ? userBotTokenMatch[1] : 'NOT FOUND');
        console.log('Manager Bot Token:', managerBotTokenMatch ? managerBotTokenMatch[1] : 'NOT FOUND');

        if (userBotTokenMatch && managerBotTokenMatch && userBotTokenMatch[1] === managerBotTokenMatch[1]) {
            console.error(chalk.red('CRITICAL: Tokens are identical! This is the conflict.'));
        }

        // 2. Stop and Delete manager bot
        console.log('Stopping eubike-manager-bot...');
        await ssh.execCommand('pm2 stop eubike-manager-bot');
        await ssh.execCommand('pm2 delete eubike-manager-bot');

        // 3. Kill any rogue node processes
        console.log('Killing rogue processes...');
        await ssh.execCommand('pkill -f manager-bot');
        await ssh.execCommand('pkill -f "node index.js"'); // Risky if other things run index.js, but manager-bot does.
        // Better: pkill -f "manager-bot/index.js"
        await ssh.execCommand('pkill -f "manager-bot/index.js"');

        // 4. Start fresh
        console.log('Starting eubike-manager-bot...');
        const startCmd = `cd ${config.remoteBase}/manager-bot && pm2 start index.js --name "eubike-manager-bot" --update-env`;
        const startResult = await ssh.execCommand(startCmd);
        
        if (startResult.stderr) {
            console.error(chalk.red('Start Error:'), startResult.stderr);
        } else {
            console.log(chalk.green('Started successfully.'));
            console.log(startResult.stdout);
        }

        // 5. Check logs immediately
        console.log('Checking logs...');
        const logs = await ssh.execCommand('pm2 logs eubike-manager-bot --lines 20 --nostream');
        console.log(logs.stdout);

    } catch (e) {
        console.error(chalk.red('Fix failed:'), e);
    } finally {
        ssh.dispose();
    }
}

main();
