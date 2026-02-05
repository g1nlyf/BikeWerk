const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
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
