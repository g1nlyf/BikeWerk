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
    console.log(chalk.red.bold('🧨 FORCE UPLOADING DATABASE TO SERVER...'));
    
    const localDbPath = path.join(config.localBase, 'backend', 'database', 'eubike.db');
    const remoteDbPath = `${config.remoteBase}/backend/database/eubike.db`;

    if (!fs.existsSync(localDbPath)) {
        console.error('Local database not found!');
        process.exit(1);
    }

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('Connected.');

        // Stop backend to release file lock if possible (though sqlite usually handles it, better safe)
        console.log('Stopping backend...');
        await ssh.execCommand('pm2 stop eubike-backend');

        console.log(`Uploading ${localDbPath} -> ${remoteDbPath}...`);
        await ssh.putFile(localDbPath, remoteDbPath);
        console.log(chalk.green('✅ Database uploaded successfully.'));

        // Restart backend
        console.log('Restarting backend...');
        await ssh.execCommand('pm2 restart eubike-backend');
        console.log('Backend restarted.');

    } catch (e) {
        console.error(chalk.red('Upload failed:'), e);
    } finally {
        ssh.dispose();
    }
}

main();
