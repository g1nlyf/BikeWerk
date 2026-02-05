const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    remoteDir: '/root'
};

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    return fs.readFileSync(PASS_FILE, 'utf8').trim();
}

async function verify() {
    const conn = new Client();
    const password = await readPassword();

    conn.on('ready', () => {
        console.log('✅ SSH Connection established for verification');
                
                // Command to get logs
                const cmd = `pm2 logs eubike-manager-bot --lines 20 --nostream`;
                
                conn.exec(cmd, (err, stream) => {
            if (err) throw err;
            
            let dataBuffer = '';
            stream.on('close', (code, signal) => {
                console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                if (code === 0 && dataBuffer.length > 0) {
                    console.log('✅ VERIFICATION SUCCESS: Found "Gemini 2.5 Flash" in remote file!');
                    console.log('Matched Content:\n', dataBuffer);
                } else {
                    console.error('❌ VERIFICATION FAILED: Did not find "Gemini 2.5 Flash" in remote file.');
                    console.log('Output was:', dataBuffer);
                }
                conn.end();
            }).on('data', (data) => {
                dataBuffer += data;
            }).stderr.on('data', (data) => {
                console.log('STDERR: ' + data);
            });
        });
    }).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: password
    });
}

verify();
