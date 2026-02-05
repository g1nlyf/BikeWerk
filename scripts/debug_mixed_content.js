const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function checkContent() {
    try {
        await ssh.connect(config);
        console.log('Connected.');
        
        // 1. Check DB for HTTP images
        console.log('--- Checking DB for HTTP images ---');
        const dbCmd = `
            cd /root/eubike/backend
            node -e "
                const db = require('better-sqlite3')('database/eubike.db');
                const rows = db.prepare(\\\"SELECT id, image_url, source_url FROM bikes WHERE image_url LIKE '%http://%' LIMIT 5\\\").all();
                console.log(JSON.stringify(rows, null, 2));
            "
        `;
        const dbRes = await ssh.execCommand(dbCmd);
        console.log(dbRes.stdout || dbRes.stderr);

        // 2. Check Nginx Config
        console.log('--- Checking Nginx Config ---');
        const nginxCmd = await ssh.execCommand('cat /etc/nginx/sites-enabled/bikewerk.ru');
        console.log(nginxCmd.stdout);

    } catch (e) {
        console.error(e);
    } finally {
        ssh.dispose();
    }
}

checkContent();
