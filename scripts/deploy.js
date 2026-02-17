const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
const { glob } = require('glob');
const chalkImport = require('chalk');
const oraImport = require('ora');
const chalk = chalkImport.default || chalkImport;
const ora = oraImport.default || oraImport;
const { execSync } = require('child_process');

// Configuration
const config = {
    host: '45.9.41.232',
    username: 'root',
    remoteBase: '/root/eubike',
    localBase: path.resolve(__dirname, '..')
};
const deployPasswordPath = path.join(config.localBase, 'deploy_password.txt');

const ssh = new NodeSSH();

// Helper: Format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper: Run local command
function runLocal(command, cwd) {
    try {
        execSync(command, { cwd, stdio: 'inherit' });
        return true;
    } catch (e) {
        console.error(chalk.red(`Command failed: ${command}`));
        return false;
    }
}

function getDeployPassword() {
    const fromEnv = process.env.EUBIKE_DEPLOY_PASSWORD?.trim();
    if (fromEnv) return fromEnv;

    if (!fs.existsSync(deployPasswordPath)) {
        throw new Error('Missing deploy password. Set EUBIKE_DEPLOY_PASSWORD or create deploy_password.txt');
    }

    const fromFile = fs.readFileSync(deployPasswordPath, 'utf8').trim();
    if (!fromFile || fromFile.includes('PASTE_YOUR_ROOT_PASSWORD_HERE')) {
        throw new Error('deploy_password.txt is empty or placeholder.');
    }

    return fromFile;
}

// Helper: Parse .env contents into a map
function parseEnv(text) {
    const map = new Map();
    if (!text) return map;
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (key) map.set(key, value);
    }
    return map;
}

// Helper: Ensure remote .env has required keys (append missing; upload if absent)
async function ensureRemoteEnv(localPath, remotePath, requiredKeys) {
    const localText = fs.existsSync(localPath) ? fs.readFileSync(localPath, 'utf8') : '';
    const localMap = parseEnv(localText);
    for (const key of requiredKeys) {
        if (!localMap.get(key)) {
            throw new Error(`Local env missing required key: ${key} (${localPath})`);
        }
    }

    const check = await ssh.execCommand(`[ -f "${remotePath}" ] && cat "${remotePath}" || true`);
    const remoteText = check.stdout || '';
    const remoteMap = parseEnv(remoteText);

    if (!remoteText.trim()) {
        await ssh.putFile(localPath, remotePath);
        return { action: 'uploaded' };
    }

    const missing = requiredKeys.filter(k => !remoteMap.get(k));
    if (missing.length > 0) {
        const toAppend = missing.map(k => `${k}=${localMap.get(k)}`).join('\n') + '\n';
        const cmd = `cat <<'EOF' >> "${remotePath}"
${toAppend}EOF`;
        await ssh.execCommand(cmd);
        return { action: 'appended', missing };
    }

    return { action: 'ok' };
}

// Helper: Sync Directory
async function syncDirectory(localDir, remoteDir, exclude = []) {
    const spinner = ora(`Syncing ${path.relative(config.localBase, localDir)}...`).start();
    
    try {
        // 1. Get all local files
        const localFiles = await glob('**/*', { 
            cwd: localDir, 
            nodir: true, 
            ignore: exclude,
            dot: true 
        });

        // 2. Get remote file stats (using find to get size and mtime)
        // Format: relative_path|size|mtime
        // We use a simple find command. Note: remote paths might have spaces.
        const remoteFilesMap = new Map();
        try {
            // Check if remote dir exists
            const checkDir = await ssh.execCommand(`[ -d "${remoteDir}" ] && echo "exists"`);
            if (checkDir.stdout.trim() !== 'exists') {
                await ssh.mkdir(remoteDir);
            }

            // List files: find . -type f -printf "%P|%s|%T@\n"
            const { stdout } = await ssh.execCommand(`find . -type f -printf "%P|%s|%T@\\n"`, { cwd: remoteDir });
            if (stdout) {
                stdout.split('\n').forEach(line => {
                    if (!line.trim()) return;
                    const [relPath, size, mtime] = line.split('|');
                    remoteFilesMap.set(relPath, { size: parseInt(size), mtime: parseFloat(mtime) });
                });
            }
        } catch (e) {
            // If find fails, assume empty
        }

        const toUpload = [];
        let totalUploadSize = 0;

        for (const file of localFiles) {
            // Normalize path separators
            const relPath = file.split(path.sep).join('/');
            const localPath = path.join(localDir, file);
            const stats = fs.statSync(localPath);
            
            const remoteFile = remoteFilesMap.get(relPath);
            
            let shouldUpload = false;
            if (!remoteFile) {
                shouldUpload = true; // New file
            } else {
                // Check size
                if (remoteFile.size !== stats.size) {
                    shouldUpload = true;
                } else {
                    // Check mtime (allow 2 second difference for clock skew/fs precision)
                    // remote mtime is seconds (float), stats.mtimeMs is milliseconds
                    const remoteTimeMs = remoteFile.mtime * 1000;
                    if (stats.mtimeMs > remoteTimeMs + 2000) {
                        shouldUpload = true;
                    }
                }
            }

            if (shouldUpload) {
                toUpload.push({ local: localPath, remote: path.posix.join(remoteDir, relPath), rel: relPath });
                totalUploadSize += stats.size;
            }
        }

        if (toUpload.length === 0) {
            spinner.succeed(`Syncing ${path.relative(config.localBase, localDir)}: Up to date`);
            return { uploadedFiles: [] };
        }

        spinner.text = `Syncing ${path.relative(config.localBase, localDir)}: Uploading ${toUpload.length} files (${formatBytes(totalUploadSize)})...`;

        // Upload in batches
        const BATCH_SIZE = 5;
        let uploaded = 0;
        
        // We use putFiles for efficiency but we want progress bars. 
        // node-ssh putFiles takes array of {local, remote}.
        
        await ssh.putFiles(toUpload.map(f => ({ local: f.local, remote: f.remote })), {
            concurrency: 1,
            transferOptions: {
                step: (total_transferred, chunk, total) => {
                    // This callback is per file or global? Documentation says per file transfer usually, 
                    // but putFiles handles multiple. 
                    // Actually node-ssh putFiles doesn't expose a global progress easily for all files combined 
                    // in a single callback unless we wrap it.
                    // Let's just update the spinner with file count.
                }
            }
        });

        spinner.succeed(`Syncing ${path.relative(config.localBase, localDir)}: Uploaded ${toUpload.length} files (${formatBytes(totalUploadSize)})`);
        return { uploadedFiles: toUpload.map(f => f.rel) };

    } catch (e) {
        spinner.fail(`Syncing ${path.relative(config.localBase, localDir)} failed: ${e.message}`);
        throw e;
    }
}

async function main() {
    console.log(chalk.green.bold('🚀 Starting Smart Deployment...'));
    
    // 1. Build Frontend
    console.log(chalk.yellow('📦 Building Frontend...'));
    const frontendDir = path.join(config.localBase, 'frontend');
    if (fs.existsSync(frontendDir)) {
        // Run install if node_modules missing? No, assume user environment is somewhat ready or run install.
        // Let's run install to be safe? It takes time. User said "update changed files".
        // Assuming dev environment is ready.
        if (!runLocal('npm run build', frontendDir)) {
            console.error(chalk.red('Frontend build failed. Aborting.'));
            process.exit(1);
        }
    } else {
        console.warn(chalk.yellow('Frontend directory not found!'));
    }

    // 2. Connect SSH
    const spinner = ora('Connecting to server...').start();
    try {
        const deployPassword = getDeployPassword();
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: deployPassword,
            tryKeyboard: true
        });
        spinner.succeed('Connected to server');
    } catch (e) {
        spinner.fail('Connection failed');
        console.error(e);
        process.exit(1);
    }

    // 2.5 Ensure required .env exists on remote (only append missing keys)
    const envSpinner = ora('Ensuring remote env secrets...').start();
    try {
        const requiredKeys = ['JWT_SECRET', 'ADMIN_SECRET', 'WEBHOOK_SECRET', 'PUBLIC_URL', 'CORS_ORIGIN'];
        const localRootEnv = path.join(config.localBase, '.env');
        const localBackendEnv = path.join(config.localBase, 'backend', '.env');
        const rootResult = await ensureRemoteEnv(localRootEnv, `${config.remoteBase}/.env`, requiredKeys);
        const backendResult = await ensureRemoteEnv(localBackendEnv, `${config.remoteBase}/backend/.env`, requiredKeys);
        envSpinner.succeed(`Remote env ok (${rootResult.action}, backend: ${backendResult.action})`);
    } catch (e) {
        envSpinner.fail(`Env setup failed: ${e.message}`);
        process.exit(1);
    }

    // 3. DB Sync (Reverse)
    const dbSpinner = ora('Checking Database...').start();
    try {
        const remoteDbPath = `${config.remoteBase}/backend/database/eubike.db`;
        const localDbPath = path.join(config.localBase, 'backend', 'database', 'eubike.db');
        
        // Ensure local dir exists
        fs.mkdirSync(path.dirname(localDbPath), { recursive: true });

        // Get remote stats
        const remoteStatCmd = await ssh.execCommand(`stat -c %Y ${remoteDbPath}`);
        const remoteMtime = parseInt(remoteStatCmd.stdout.trim()); // Seconds

        if (!isNaN(remoteMtime)) {
            let shouldDownload = false;
            if (fs.existsSync(localDbPath)) {
                const localStat = fs.statSync(localDbPath);
                const localMtime = localStat.mtimeMs / 1000; // Seconds
                
                if (remoteMtime > localMtime) {
                    shouldDownload = true;
                    dbSpinner.text = 'Remote DB is newer. Downloading...';
                } else {
                    dbSpinner.succeed('Local DB is up to date (or newer).');
                }
            } else {
                shouldDownload = true;
                dbSpinner.text = 'Local DB missing. Downloading...';
            }

            if (shouldDownload) {
                await ssh.getFile(localDbPath, remoteDbPath);
                dbSpinner.succeed('Database synced from server.');
            }
        } else {
            dbSpinner.warn('Remote database not found or inaccessible.');
        }
    } catch (e) {
        dbSpinner.fail(`Database sync failed: ${e.message}`);
    }

    // 4. File Sync
    console.log(chalk.cyan('📂 Syncing Files...'));

    // Backend
    const backendSync = await syncDirectory(
        path.join(config.localBase, 'backend'),
        `${config.remoteBase}/backend`,
        ['node_modules/**', '.env', 'database/**', '.git/**', 'tmp/**']
    );
    if (backendSync.uploadedFiles.includes('package.json')) {
        const iSpinner = ora('Installing Backend dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/backend` });
        iSpinner.succeed('Backend dependencies installed');
    }

    // Telegram Bot
    const botSync = await syncDirectory(
        path.join(config.localBase, 'telegram-bot'),
        `${config.remoteBase}/telegram-bot`,
        ['node_modules/**', '.env', '.git/**']
    );
    if (botSync.uploadedFiles.includes('package.json')) {
        const iSpinner = ora('Installing Telegram Bot dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/telegram-bot` });
        iSpinner.succeed('Telegram Bot dependencies installed');
    }

    // Client Telegram Bot
    const clientBotSync = await syncDirectory(
        path.join(config.localBase, 'client-telegram-bot'),
        `${config.remoteBase}/client-telegram-bot`,
        ['node_modules/**', '.env', '.git/**']
    );
    if (clientBotSync.uploadedFiles.includes('package.json')) {
        const iSpinner = ora('Installing Client Telegram Bot dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/client-telegram-bot` });
        iSpinner.succeed('Client Telegram Bot dependencies installed');
    }

    // Manager Bot (God Mode)
    const managerBotSync = await syncDirectory(
        path.join(config.localBase, 'manager-bot'),
        `${config.remoteBase}/manager-bot`,
        ['node_modules/**', '.env', '.git/**']
    );
    if (managerBotSync.uploadedFiles.includes('package.json')) {
        const iSpinner = ora('Installing Manager Bot dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/manager-bot` });
        iSpinner.succeed('Manager Bot dependencies installed');
    }

    // Hot Deals Bot
    const hotDealsBotSync = await syncDirectory(
        path.join(config.localBase, 'hot-deals-bot'),
        `${config.remoteBase}/hot-deals-bot`,
        ['node_modules/**', '.env', '.git/**']
    );
    if (hotDealsBotSync.uploadedFiles.includes('package.json')) {
        const iSpinner = ora('Installing Hot Deals Bot dependencies...').start();
        await ssh.execCommand('npm install', { cwd: `${config.remoteBase}/hot-deals-bot` });
        iSpinner.succeed('Hot Deals Bot dependencies installed');
    }

    // Scripts (for maintenance)
    await syncDirectory(
        path.join(config.localBase, 'scripts'),
        `${config.remoteBase}/scripts`,
        ['node_modules/**', '.env', '.git/**']
    );

    // Frontend (Dist)
    await syncDirectory(
        path.join(config.localBase, 'frontend', 'dist'),
        `${config.remoteBase}/frontend/dist`,
        []
    );

    // Root runtime config needed by PM2 on server
    const ecosystemLocal = path.join(config.localBase, 'ecosystem.config.js');
    const ecosystemRemote = `${config.remoteBase}/ecosystem.config.js`;
    const ecosystemSpinner = ora('Syncing PM2 ecosystem config...').start();
    await ssh.putFile(ecosystemLocal, ecosystemRemote);
    ecosystemSpinner.succeed('PM2 ecosystem config synced');

    // Copy frontend to /var/www/html (for Nginx)
    console.log(chalk.cyan('🔄 Updating Nginx static files...'));
    await ssh.execCommand('cp -r frontend/dist/* /var/www/html/', { cwd: config.remoteBase });
    await ssh.execCommand('chown -R www-data:www-data /var/www/html');

    // 4.5 Reset DB if requested
    if (process.argv.includes('--reset-db')) {
        const resetSpinner = ora('🧨 Resetting Remote Database...').start();
        try {
            // We use backend's sqlite3
            const cmd = 'export NODE_PATH=./backend/node_modules && node scripts/reset_db.js';
            const result = await ssh.execCommand(cmd, { cwd: config.remoteBase });
            
            if (result.code === 0) {
                resetSpinner.succeed('Remote Database CLEARED.');
                console.log(chalk.gray(result.stdout));
            } else {
                resetSpinner.fail('Failed to reset database.');
                console.error(result.stderr);
            }
        } catch (e) {
            resetSpinner.fail(`Reset failed: ${e.message}`);
        }
    }

    // 5. Restart Services
    const restartSpinner = ora('Restarting services...').start();
    try {
        // Reload process definitions and restart declared services (includes new bots)
        const pm2Result = await ssh.execCommand('pm2 startOrReload ecosystem.config.js --update-env && pm2 save', { cwd: config.remoteBase });
        
        if (pm2Result.code !== 0) {
            // Fallback to direct starts for critical services
            console.log(chalk.yellow('pm2 startOrReload failed, attempting individual starts...'));
            await ssh.execCommand('pm2 restart eubike-backend || pm2 start ./backend/server.js --name "eubike-backend"', { cwd: `${config.remoteBase}` });
            await ssh.execCommand('pm2 restart telegram-bot || pm2 start ./telegram-bot/bot.js --name "telegram-bot"', { cwd: `${config.remoteBase}` });
            await ssh.execCommand('pm2 restart manager-bot || pm2 start ./manager-bot/index.js --name "manager-bot"', { cwd: `${config.remoteBase}` });
            await ssh.execCommand('pm2 restart hot-deals-bot || pm2 start ./hot-deals-bot/index.js --name "hot-deals-bot"', { cwd: `${config.remoteBase}` });
        }

        // Reload Nginx
        await ssh.execCommand('systemctl reload nginx');
        
        restartSpinner.succeed('Services restarted & Nginx reloaded.');
    } catch (e) {
        restartSpinner.warn(`Service restart warning: ${e.message}`);
    }

    console.log(chalk.green.bold('✅ Deployment Complete!'));
    ssh.dispose();
}

main().catch(err => {
    console.error(chalk.red('Deployment failed:'), err);
    process.exit(1);
});
