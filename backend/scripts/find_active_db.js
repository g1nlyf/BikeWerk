const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root'
};

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) throw new Error(`Password file not found: ${PASS_FILE}`);
    return fs.readFileSync(PASS_FILE, 'utf8').trim();
}

async function run() {
    try {
        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('✅ Connected via SSH');
            
            // Find PID and open files
            const cmd = `
                PID=$(pgrep -f "eubike-backend")
                echo "PID: $PID"
                if [ -n "$PID" ]; then
                    ls -l /proc/$PID/cwd
                    echo "--- Open Files ---"
                    ls -l /proc/$PID/fd
                    echo "--- Environment ---"
                    cat /proc/$PID/environ | tr '\\0' '\\n' | grep DB
                fi
            `;
            
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code) => {
                    console.log(`Check finished with code ${code}`);
                    conn.end();
                }).on('data', (data) => {
                    process.stdout.write(data);
                });
            });
        }).connect({
            ...config,
            password
        });
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
