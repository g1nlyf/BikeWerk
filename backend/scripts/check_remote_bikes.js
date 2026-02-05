const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

// Config
const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root'
};

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

async function runRemoteCommand() {
    try {
        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('✅ Connected. Checking remote bikes...');
            const safeCmd = `cd /root/eubike && node scripts/verify-hunt-distribution.js && node -e "const sqlite3=require('sqlite3');const db=new sqlite3.Database('backend/database/eubike.db');db.all('SELECT id,name,category,price,is_active FROM bikes ORDER BY id DESC LIMIT 10',(e,r)=>{if(e)console.log(e);else console.table(r);db.close();});"`;

            conn.exec(safeCmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log(`\n🎁 Process finished with code ${code}`);
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        }).connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: password
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

runRemoteCommand();
