const { NodeSSH } = require('node-ssh');
const path = require('path');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike',
    localBase: path.resolve(__dirname, '..')
};

const ssh = new NodeSSH();

async function main() {
    console.log(chalk.blue('🔄 Updating Bots & Restarting Services...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });

        // Upload updated bot.js
        console.log('Uploading bot.js...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/bot.js'),
            `${config.remoteBase}/telegram-bot/bot.js`
        );
        console.log('✅ bot.js uploaded.');

        // Restart Everything
        console.log('Restarting all PM2 services...');
        await ssh.execCommand('pm2 restart all');
        
        console.log('Verifying services...');
        const pm2List = await ssh.execCommand('pm2 list');
        console.log(pm2List.stdout);

    } catch (e) {
        console.error(chalk.red('Update failed:'), e);
    } finally {
        ssh.dispose();
    }
}

main();
