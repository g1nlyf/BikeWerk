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
    console.log(chalk.green('🚀 Uploading .env files...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('Connected to server');

        const envFiles = [
            { local: 'telegram-bot/.env', remote: 'telegram-bot/.env' },
            { local: 'client-telegram-bot/.env', remote: 'client-telegram-bot/.env' },
            { local: 'backend/.env', remote: 'backend/.env' }
        ];

        for (const file of envFiles) {
            const localPath = path.join(config.localBase, file.local);
            const remotePath = `${config.remoteBase}/${file.remote}`;

            if (fs.existsSync(localPath)) {
                console.log(`Uploading ${file.local}...`);
                await ssh.putFile(localPath, remotePath);
                console.log(`✅ Uploaded ${file.local}`);
            } else {
                console.warn(`⚠️ Local file not found: ${file.local}`);
            }
        }

        console.log(chalk.green('✅ All .env files uploaded.'));
        
        // Restart services to apply changes
        console.log('Restarting services...');
        await ssh.execCommand('pm2 restart eubike-bot', { cwd: `${config.remoteBase}/telegram-bot` });
        await ssh.execCommand('pm2 restart eubike-client-bot', { cwd: `${config.remoteBase}/client-telegram-bot` });
        // Backend restart just in case
        await ssh.execCommand('pm2 restart eubike-backend', { cwd: `${config.remoteBase}/backend` });
        console.log('✅ Services restarted.');

    } catch (e) {
        console.error(chalk.red('Failed:'), e);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

main();
