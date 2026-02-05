const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');
const ora = require('ora');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log(chalk.green.bold('🔄 Restarting Server Services...'));
    
    const spinner = ora('Connecting to server...').start();
    
    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        spinner.succeed('Connected to server');
    } catch (e) {
        spinner.fail('Connection failed');
        console.error(e);
        process.exit(1);
    }

    try {
        // 1. Restart PM2 services
        spinner.start('Restarting PM2 services...');
        const pm2Result = await ssh.execCommand('pm2 restart all');
        if (pm2Result.code === 0) {
            spinner.succeed('PM2 services restarted');
            console.log(chalk.gray(pm2Result.stdout));
        } else {
            spinner.warn('PM2 restart warning');
            console.error(chalk.red(pm2Result.stderr));
        }

        // 2. Reload Nginx (if applicable)
        spinner.start('Reloading Nginx...');
        const nginxResult = await ssh.execCommand('systemctl reload nginx');
        if (nginxResult.code === 0) {
            spinner.succeed('Nginx reloaded');
        } else {
            // Check if nginx is even installed/running
            const nginxStatus = await ssh.execCommand('systemctl is-active nginx');
            if (nginxStatus.stdout.trim() === 'active') {
                 spinner.fail('Nginx reload failed');
                 console.error(chalk.red(nginxResult.stderr));
            } else {
                spinner.info('Nginx not active or not installed (skipping)');
            }
        }

        console.log(chalk.green.bold('✅ Server Restart Completed!'));

    } catch (e) {
        spinner.fail(`Restart failed: ${e.message}`);
    } finally {
        ssh.dispose();
    }
}

main();
