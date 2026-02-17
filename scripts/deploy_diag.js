const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

function getPassword() {
    if (process.env.EUBIKE_DEPLOY_PASSWORD) {
        return process.env.EUBIKE_DEPLOY_PASSWORD.trim();
    }

    if (!fs.existsSync(PASS_FILE)) {
        throw new Error('Missing deploy password. Set EUBIKE_DEPLOY_PASSWORD or create deploy_password.txt');
    }

    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    if (!pass || pass.includes('PASTE_YOUR_ROOT_PASSWORD_HERE')) {
        throw new Error('deploy_password.txt is empty or contains placeholder content');
    }

    return pass;
}

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: getPassword(),
    remoteBase: '/root/eubike',
    localBase: 'c:\\Users\\hacke\\CascadeProjects\\Finals1\\eubike'
};

async function deployAndDiagnose() {
    try {
        console.log('🚀 Deploying Diagnosis Script...');
        
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        await ssh.putFile(
            path.join(config.localBase, 'scripts/diagnose_connection.js'),
            `${config.remoteBase}/scripts/diagnose_connection.js`
        );
        console.log('📂 Uploaded diagnose_connection.js');

        console.log('🧪 Running Diagnosis on Server...');
        const result = await ssh.execCommand('node scripts/diagnose_connection.js', { cwd: config.remoteBase });
        
        console.log('\n--- SERVER OUTPUT ---');
        console.log(result.stdout);
        console.log(result.stderr);
        console.log('---------------------\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        ssh.dispose();
    }
}

deployAndDiagnose();
