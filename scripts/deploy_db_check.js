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

async function deployAndCheck() {
    try {
        console.log('🚀 Checking Remote Database Content...');
        
        // Connect to server
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // Upload check script
        await ssh.putFile(
            path.join(config.localBase, 'scripts/check_db_content.js'),
            `${config.remoteBase}/scripts/check_db_content.js`
        );

        // Run check script
        console.log('🧪 Running DB Check...');
        const result = await ssh.execCommand('node scripts/check_db_content.js', { cwd: config.remoteBase });
        
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

deployAndCheck();
