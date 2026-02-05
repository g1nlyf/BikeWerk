const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    await ssh.connect(config);

    console.log('--- PM2 Env ---');
    const env = await ssh.execCommand('pm2 env 6');
    console.log(env.stdout);

    console.log('\n--- Netstat All ---');
    const netstat = await ssh.execCommand('netstat -tulpn');
    console.log(netstat.stdout);

    ssh.dispose();
}

main();
