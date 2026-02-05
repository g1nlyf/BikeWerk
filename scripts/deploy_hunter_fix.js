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

async function deploy() {
    try {
        console.log('🚀 Starting Hunter Fix Deployment...');
        
        // Connect to server
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // Upload AutonomousOrchestrator.js
        console.log('📂 Uploading updated AutonomousOrchestrator.js...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/AutonomousOrchestrator.js'),
            `${config.remoteBase}/telegram-bot/AutonomousOrchestrator.js`
        );
        console.log('✅ File uploaded');

        // Restart bots
        console.log('🔄 Restarting services...');
        await ssh.execCommand('pm2 restart all');
        console.log('✅ Services restarted');

        console.log('✨ Deployment Complete! Hunter should now alert AdminBot correctly.');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
    } finally {
        ssh.dispose();
    }
}

deploy();
