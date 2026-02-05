const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
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
    console.log(chalk.green('🚀 Deploying Admin Bot...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('Connected to server');

        // Upload AdminBotService.js and admin-bot.js
        const filesToUpload = [
            { local: 'telegram-bot/AdminBotService.js', remote: 'telegram-bot/AdminBotService.js' },
            { local: 'telegram-bot/admin-bot.js', remote: 'telegram-bot/admin-bot.js' },
            { local: 'telegram-bot/.env', remote: 'telegram-bot/.env' }
        ];

        for (const file of filesToUpload) {
            const localPath = path.join(config.localBase, file.local);
            const remotePath = `${config.remoteBase}/${file.remote}`;
            console.log(`Uploading ${file.local}...`);
            await ssh.putFile(localPath, remotePath);
        }

        console.log('✅ Files uploaded.');

        // Start with PM2
        console.log('Starting Admin Bot with PM2...');
        const cmd = 'pm2 restart eubike-admin-bot || pm2 start admin-bot.js --name "eubike-admin-bot"';
        await ssh.execCommand(cmd, { cwd: `${config.remoteBase}/telegram-bot` });
        
        console.log('✅ Admin Bot started.');
        
        // List processes
        const result = await ssh.execCommand('pm2 list');
        console.log('\nPM2 Status:');
        console.log(result.stdout);

    } catch (e) {
        console.error(chalk.red('Failed:'), e);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

main();
