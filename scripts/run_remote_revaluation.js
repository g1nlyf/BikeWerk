const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike'
};

const ssh = new NodeSSH();

async function run() {
    console.log(chalk.blue('🚀 Connecting to server to trigger Remote Re-evaluation...'));
    
    try {
        await ssh.connect(config);
        console.log(chalk.green('✔ Connected.'));

        console.log(chalk.yellow('⏳ Running revaluate_catalog.js on server (background)...'));
        
        // Run in background using nohup or pm2, or just run and wait?
        // The user wants it done. Let's run it and stream output if possible, or just start it.
        // Since it might take long, better to run it via PM2 or just let it run.
        // Let's run it directly but with a timeout or just wait. It processes 75 bikes, 2s delay + API time = ~5 mins.
        
        const result = await ssh.execCommand('export NODE_PATH=/root/eubike/backend/node_modules && node scripts/revaluate_catalog.js', { 
            cwd: config.remoteBase,
            onStdout: (chunk) => process.stdout.write(chunk.toString()),
            onStderr: (chunk) => process.stderr.write(chunk.toString())
        });

        console.log(chalk.green('✅ Remote Re-evaluation Finished.'));
        ssh.dispose();

    } catch (e) {
        console.error(chalk.red('❌ Failed:'), e);
        process.exit(1);
    }
}

run();
