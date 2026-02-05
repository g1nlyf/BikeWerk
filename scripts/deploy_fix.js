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

async function deployFix() {
    console.log(chalk.green('🚀 Starting Deploy Fix (Sprint 0.1)...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // 1. Upload Backend Files
        const backendFiles = [
            'src/services/geminiProcessor.js',
            'src/services/ManagerBotService.js',
            'src/services/BookingService.js'
        ];
        
        for (const file of backendFiles) {
            console.log(`Uploading backend/${file}...`);
            await ssh.putFile(
                path.resolve(__dirname, `../backend/${file}`),
                `${config.remoteBase}/backend/${file}`
            );
        }

        // 2. Upload Frontend Files
        const frontendFiles = [
            'src/pages/GuestOrderWizardPage.tsx',
            'src/components/checkout/OrderSuccessOverlay.tsx'
        ];

        for (const file of frontendFiles) {
            console.log(`Uploading frontend/${file}...`);
            await ssh.putFile(
                path.resolve(__dirname, `../frontend/${file}`),
                `${config.remoteBase}/frontend/${file}`
            );
        }

        // 3. Upload Telegram Bot Files
        const botFiles = [
            'manager-bot.js',
            'ecosystem.config.js'
        ];

        for (const file of botFiles) {
            console.log(`Uploading telegram-bot/${file}...`);
            await ssh.putFile(
                path.resolve(__dirname, `../telegram-bot/${file}`),
                `${config.remoteBase}/telegram-bot/${file}`
            );
        }

        console.log('✅ All files uploaded.');

        // 4. Restart Backend (to pick up Service changes)
        console.log('🔄 Restarting Backend...');
        await ssh.execCommand('pm2 restart eubike-backend');

        // 5. Start Manager Bot
        console.log('🤖 Starting Manager Bot...');
        // We use ecosystem.config.js to start/restart
        // First, ensure deps (https-proxy-agent might be missing in telegram-bot if not installed)
        await ssh.execCommand('npm install https-proxy-agent axios dotenv', { cwd: `${config.remoteBase}/telegram-bot` });
        
        // Clean old process to avoid conflict with potential old "manager-bot" folder
        console.log('🧹 Cleaning old PM2 process...');
        await ssh.execCommand('pm2 delete eubike-manager-bot');
        
        // Reload PM2 config
        await ssh.execCommand('pm2 start ecosystem.config.js', { cwd: `${config.remoteBase}/telegram-bot` });
        await ssh.execCommand('pm2 save');

        // 6. Rebuild Frontend
        console.log('🏗️ Rebuilding Frontend (this takes time)...');
        const buildRes = await ssh.execCommand('npm run build', { cwd: `${config.remoteBase}/frontend` });
        if (buildRes.stderr && !buildRes.stderr.includes('warn')) {
             console.log(chalk.yellow('Build Output:'), buildRes.stdout); // Log stdout anyway
             console.error(chalk.red('Build Errors:'), buildRes.stderr);
        } else {
             console.log('✅ Frontend Built.');
        }

        console.log('🔄 Restarting Frontend...');
        await ssh.execCommand('pm2 restart eubike-frontend');

        console.log(chalk.green('🎉 Deployment Complete!'));
        
        // Check Manager Bot Logs
        console.log('\n🔎 Checking Manager Bot Logs...');
        const logs = await ssh.execCommand('pm2 logs eubike-manager-bot --lines 20 --nostream');
        console.log(logs.stdout);

    } catch (e) {
        console.error(chalk.red('Deployment Failed:'), e);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

deployFix();
