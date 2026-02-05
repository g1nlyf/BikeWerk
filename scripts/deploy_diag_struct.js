const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

// Configuration
const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike',
    localBase: 'c:\\Users\\hacke\\CascadeProjects\\Finals1\\eubike'
};

async function deployAndDiagnose() {
    try {
        console.log('🚀 Diagnosing DB Structure...');
        
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        await ssh.putFile(
            path.join(config.localBase, 'scripts/diagnose_db_struct.js'),
            `${config.remoteBase}/scripts/diagnose_db_struct.js`
        );

        console.log('🧪 Running Diagnosis...');
        const result = await ssh.execCommand('node scripts/diagnose_db_struct.js', { cwd: config.remoteBase });
        
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
