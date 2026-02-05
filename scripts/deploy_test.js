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

async function deployAndTest() {
    try {
        console.log('🚀 Deploying Test Script...');
        
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        await ssh.putFile(
            path.join(config.localBase, 'scripts/test_gemini_models.js'),
            `${config.remoteBase}/scripts/test_gemini_models.js`
        );
        console.log('📂 Uploaded test_gemini_models.js');

        console.log('🧪 Running Test Script on Server...');
        const result = await ssh.execCommand('node scripts/test_gemini_models.js', { cwd: config.remoteBase });
        
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

deployAndTest();
