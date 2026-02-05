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

async function deploySprint03() {
    console.log(chalk.green('🚀 Starting Deploy Sprint 0.3...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true,
            readyTimeout: 60000 // Increase timeout to 60s
        });
        console.log('✅ Connected via SSH');

        // 1. Upload Backend Files
        const backendFiles = [
            'server.js',
            'src/routes/v1/modules/booking.ts',
            'src/services/geminiProcessor.js',
            'src/services/ManagerBotService.js',
            'src/services/BookingService.js',
            'src/services/PriceCalculatorService.js',
            'scripts/crm-api.js',
            'package.json'
        ];
        
        for (const file of backendFiles) {
            console.log(`Uploading backend/${file}...`);
            await ssh.putFile(
                path.resolve(__dirname, `../backend/${file}`),
                `${config.remoteBase}/backend/${file}`
            );
        }

        // 2. Upload Frontend Source (Sync Entire Source)
        console.log('📂 Syncing frontend/src...');
        await ssh.putDirectory(
            path.resolve(__dirname, '../frontend/src'),
            `${config.remoteBase}/frontend/src`,
            {
                recursive: true,
                concurrency: 10,
                validate: (itemPath) => {
                    const baseName = path.basename(itemPath);
                    return baseName !== 'node_modules' && baseName !== '.git';
                }
            }
        );

        // Upload package.json
        console.log('Uploading frontend/package.json...');
        await ssh.putFile(
            path.resolve(__dirname, '../frontend/package.json'),
            `${config.remoteBase}/frontend/package.json`
        );

        // 2.1 Upload Telegram Bot Config
        console.log('Uploading telegram-bot/ecosystem.config.js...');
        await ssh.putFile(
            path.resolve(__dirname, '../telegram-bot/ecosystem.config.js'),
            `${config.remoteBase}/telegram-bot/ecosystem.config.js`
        );

        // 3. Upload Migration
        await ssh.putFile(
            path.resolve(__dirname, '../backend/migrations/supabase_sprint0.3_fix.sql'),
            `${config.remoteBase}/backend/migrations/supabase_sprint0.3_fix.sql`
        );

        console.log('✅ All files uploaded.');

        // 4. Install Deps & Apply Migration
        console.log('📦 Installing Backend Dependencies...');
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/backend` });
        
        console.log('🗄️ Uploading DB Migration (Supabase)...');
        // Note: Supabase migrations should be applied manually or via Supabase CLI. 
        // The sqlite3 command is kept if there is a local legacy DB, but we updated the file reference.
        // await ssh.execCommand('sqlite3 database/eubike.db < migrations/sprint0.3_pricing_fields.sql', { cwd: `${config.remoteBase}/backend` });
        console.log('⚠️ Please apply backend/migrations/supabase_sprint0.3_fix.sql to Supabase manually if not already done.');

        // 5. Restart Services
        console.log('🔄 Restarting Backend...');
        await ssh.execCommand('pm2 restart eubike-backend');

        console.log('🤖 Restarting Manager Bot...');
        // Ensure bot deps are also updated if it relies on backend package.json or its own
        // Manager bot code is in backend/src/services but run via telegram-bot/manager-bot.js
        // We need to ensure node-telegram-bot-api is available to the backend process if ManagerBotService is used there?
        // Wait, ManagerBotService is imported by BookingService in Backend.
        // So Backend needs node-telegram-bot-api. We added it to backend/package.json.
        // The standalone manager-bot.js also uses it.
        // Let's restart both.
        // Clean up old instances to avoid 409 Conflict
        await ssh.execCommand('pm2 delete eubike-manager-bot', { cwd: `${config.remoteBase}/telegram-bot` }).catch(() => {});
        await ssh.execCommand('pm2 restart eubike-manager-bot || pm2 start ecosystem.config.js', { cwd: `${config.remoteBase}/telegram-bot` });

        // 6. Rebuild Frontend
        console.log('🏗️ Rebuilding Frontend...');
        
        // Clean dist first to ensure no stale files
        await ssh.execCommand('rm -rf dist', { cwd: `${config.remoteBase}/frontend` });
        
        // Install Frontend Deps
        console.log('📦 Installing Frontend Dependencies...');
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/frontend` });

        const buildRes = await ssh.execCommand('npm run build', { cwd: `${config.remoteBase}/frontend` });
        
        if (buildRes.code !== 0) {
            console.error(chalk.red('❌ Build Failed!'));
            console.log(chalk.yellow('Build Output:'), buildRes.stdout);
            console.error(chalk.red('Build Errors:'), buildRes.stderr);
            process.exit(1);
        } else {
             console.log('✅ Build Success');
        }

        await ssh.execCommand('pm2 restart eubike-frontend');

        console.log(chalk.green('🎉 Deployment Complete!'));
        
        // Check Logs
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

deploySprint03();
