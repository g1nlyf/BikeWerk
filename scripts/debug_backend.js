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
    console.log(chalk.blue('🔍 Deep Server Diagnosis...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });

        // 1. Check Port Binding
        console.log(chalk.yellow('\n1. Backend Port (8082) Binding:'));
        const netstat = await ssh.execCommand('netstat -tulpn | grep 8082');
        console.log(netstat.stdout || 'No process on 8082!');

        // 2. Check Nginx Config
        console.log(chalk.yellow('\n2. Nginx Configuration (sites-enabled):'));
        const nginxConfig = await ssh.execCommand('cat /etc/nginx/sites-enabled/default'); // Or whatever file is used
        console.log(nginxConfig.stdout.substring(0, 500) + '...'); // First 500 chars

        // 3. Check Nginx Error Log
        console.log(chalk.yellow('\n3. Nginx Error Log (Last 20 lines):'));
        const nginxLog = await ssh.execCommand('tail -n 20 /var/log/nginx/error.log');
        console.log(nginxLog.stdout || nginxLog.stderr);

        // 4. Check Backend Connectivity from Localhost
        console.log(chalk.yellow('\n4. Curl Backend from Server Localhost:'));
        const curl = await ssh.execCommand('curl -v http://127.0.0.1:8082/api/rates/eur');
        console.log(curl.stdout || curl.stderr);

    } catch (e) {
        console.error(chalk.red('Diagnosis failed:'), e);
    } finally {
        ssh.dispose();
    }
}

main();
