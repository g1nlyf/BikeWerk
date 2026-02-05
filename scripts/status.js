const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    try {
        await ssh.connect(config);
        const result = await ssh.execCommand('pm2 list');
        console.log(result.stdout);
        ssh.dispose();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();