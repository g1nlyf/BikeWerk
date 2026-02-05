const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    localDb: path.resolve(__dirname, '../backend/database/eubike.db'),
    remoteDb: '/root/eubike/backend/database/eubike.db'
};

const ssh = new NodeSSH();

async function main() {
    console.log('Fixing Server Configuration...');
    await ssh.connect({
        host: config.host,
        username: config.username,
        password: config.password
    });

    try {
        // 1. Upload Database (Fix SQLITE_ERROR)
        console.log('Uploading Database...');
        if (fs.existsSync(config.localDb)) {
            await ssh.putFile(config.localDb, config.remoteDb);
            console.log('Database uploaded.');
        } else {
            console.error('Local database not found!');
        }

        // 2. Fix Nginx Config (Port 8081 -> 3001)
        console.log('Updating Nginx Proxy Port to 3001...');
        const cmd = `sed -i 's/127.0.0.1:8081/127.0.0.1:3001/g' /etc/nginx/sites-available/default`;
        await ssh.execCommand(cmd);

        // 3. Reload Nginx
        console.log('Reloading Nginx...');
        await ssh.execCommand('systemctl reload nginx');

        // 4. Restart Backend
        console.log('Restarting Backend...');
        await ssh.execCommand('pm2 restart eubike-backend');

        console.log('✅ Fixes applied.');

    } catch (e) {
        console.error('Error:', e);
    }

    ssh.dispose();
}

main();
