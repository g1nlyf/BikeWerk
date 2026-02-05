const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function check() {
    try {
        await ssh.connect(config);
        console.log('Connected.');
        
        console.log('--- Nginx Status ---');
        try {
            const nginx = await ssh.execCommand('systemctl status nginx --no-pager');
            console.log(nginx.stdout || nginx.stderr);
        } catch(e) { console.log('Nginx check failed'); }

        console.log('--- Ports ---');
        const ports = await ssh.execCommand('netstat -tuln');
        console.log(ports.stdout);

        console.log('--- PM2 List ---');
        const pm2 = await ssh.execCommand('pm2 list');
        console.log(pm2.stdout);

        ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}

check();
