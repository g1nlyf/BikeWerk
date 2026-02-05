const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
};

async function readPassword() {
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

async function runRemoteCommand() {
    try {
        const password = await readPassword();
        const conn = new Client();
        conn.on('ready', () => {
            console.log('✅ Connected. Executing force_hunt_no_gemini.js...');
            conn.exec('cd /root/eubike/telegram-bot && node force_hunt_no_gemini.js', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code) => {
                    console.log(`Exit code: ${code}`);
                    conn.end();
                    process.exit(code);
                }).on('data', (data) => process.stdout.write(data));
            });
        }).connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: password
        });
    } catch (e) { console.error(e); process.exit(1); }
}

runRemoteCommand();
