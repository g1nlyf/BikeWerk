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
    console.log(chalk.green('🚀 Redeploying PM2 Config (Fixing Ports)...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('Connected to server');

        console.log('Uploading ecosystem.config.js...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/ecosystem.config.js'),
            `${config.remoteBase}/telegram-bot/ecosystem.config.js`
        );
        console.log('✅ Uploaded ecosystem.config.js');

        console.log('Restarting PM2...');
        await ssh.execCommand('pm2 delete all');
        const startResult = await ssh.execCommand('pm2 start ecosystem.config.js', { cwd: `${config.remoteBase}/telegram-bot` });
        
        if (startResult.code !== 0) {
             console.error('PM2 Start Error:', startResult.stderr);
        } else {
             console.log('✅ PM2 Started Successfully');
             console.log(startResult.stdout);
        }
        
        await ssh.execCommand('pm2 save');

    } catch (e) {
        console.error(chalk.red('Failed:'), e);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

main();
