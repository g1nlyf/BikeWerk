const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike'
};

const ssh = new NodeSSH();

async function main() {
    console.log(chalk.blue('🔧 Fixing Nginx Configuration...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });

        // 1. Read current config
        console.log('Reading Nginx config...');
        const result = await ssh.execCommand('cat /etc/nginx/sites-available/default');
        let nginxConf = result.stdout;

        if (nginxConf.includes('127.0.0.1:3001')) {
            console.log(chalk.yellow('Found incorrect port 3001. Replacing with 8082...'));
            // Replace all instances of 3001 with 8082
            const newConf = nginxConf.replace(/127\.0\.0\.1:3001/g, '127.0.0.1:8082');
            
            // Write back to a temp file then move (safer with sudo/permissions)
            // But we are root, so we can write directly if we handle escaping or use echo
            // Actually, node-ssh putContent is easier but requires a local file.
            // We'll write to a temporary local file first.
            const fs = require('fs');
            fs.writeFileSync('nginx_default.tmp', newConf);
            
            await ssh.putFile('nginx_default.tmp', '/etc/nginx/sites-available/default');
            fs.unlinkSync('nginx_default.tmp');
            
            console.log('Config updated.');
            
            // Test config
            const test = await ssh.execCommand('nginx -t');
            if (test.stderr.includes('successful')) {
                console.log(chalk.green('Nginx config test passed. Reloading...'));
                await ssh.execCommand('systemctl reload nginx');
                console.log(chalk.green('✅ Nginx reloaded. 502 Errors should be gone.'));
            } else {
                console.error(chalk.red('❌ Nginx config test failed:'), test.stderr);
            }
        } else {
            console.log(chalk.green('Nginx config already seems to use correct port (or 3001 not found).'));
            console.log('Current proxy_pass lines:');
            console.log(nginxConf.match(/proxy_pass.*/g));
        }

    } catch (e) {
        console.error(chalk.red('Fix failed:'), e);
    } finally {
        ssh.dispose();
    }
}

main();
