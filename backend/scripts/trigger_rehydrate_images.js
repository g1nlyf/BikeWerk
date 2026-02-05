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
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    return fs.readFileSync(PASS_FILE, 'utf8').trim();
}

async function runRemoteCommand() {
    try {
        const password = await readPassword();
        const conn = new Client();

        const passthrough = process.argv.slice(2).map((s) => String(s).replace(/"/g, '\\"')).join(' ');
        const cmd = `cd /root/eubike && node backend/scripts/rehydrate-images.js ${passthrough}`.trim();

        console.log('🔌 Подключаюсь к удаленному серверу...');

        conn.on('ready', () => {
            console.log(`✅ Подключено. Запускаю: ${cmd}`);

            conn.exec(cmd, (err, stream) => {
                if (err) throw err;

                stream.on('close', (code) => {
                    console.log(`\n🎁 Удаленный процесс завершился с кодом ${code}`);
                    conn.end();
                    process.exit(code);
                }).on('data', (data) => {
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        }).on('error', (err) => {
            console.error('❌ Ошибка подключения:', err);
            process.exit(1);
        }).connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: password
        });
    } catch (e) {
        console.error('❌ Ошибка:', e.message);
        process.exit(1);
    }
}

runRemoteCommand();

