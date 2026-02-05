const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log(chalk.green('🔍 Diagnosing 502 Error...'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });

        // 1. Check Listening Ports
        console.log('Checking listening ports (Node & PM2)...');
        // lsof -i -P -n | grep LISTEN
        const ports = await ssh.execCommand('netstat -tulpn | grep LISTEN');
        console.log('Active Ports:\n', ports.stdout || 'Netstat failed, trying ss...');
        if (!ports.stdout) {
             const ss = await ssh.execCommand('ss -tulpn | grep LISTEN');
             console.log(ss.stdout);
        }

        // 2. Check Nginx Config
        console.log('\nChecking Nginx Config for Proxy Pass...');
        // Try standard locations
        const nginxConf = await ssh.execCommand('grep -r "proxy_pass" /etc/nginx/sites-enabled/');
        console.log('Nginx Proxy Rules:\n', nginxConf.stdout);

        // 3. Check PM2 Status Details
        console.log('\nChecking PM2 Details...');
        const pm2List = await ssh.execCommand('pm2 jlist');
        try {
            const processes = JSON.parse(pm2List.stdout);
            const backend = processes.find(p => p.name === 'eubike-backend');
            if (backend) {
                console.log(`Backend Status: ${backend.pm2_env.status}`);
                console.log(`Backend Port (Env): ${backend.pm2_env.PORT}`);
            } else {
                console.error('Backend process not found in PM2!');
            }
        } catch (e) {
            console.log('Could not parse PM2 list');
        }

        // 4. Check Nginx Error Log
        console.log('\nReading Nginx Error Log (Last 10 lines)...');
        const nginxLog = await ssh.execCommand('tail -n 10 /var/log/nginx/error.log');
        console.log(nginxLog.stdout);

    } catch (e) {
        console.error(chalk.red('Failed:'), e);
    } finally {
        ssh.dispose();
    }
}

main();
