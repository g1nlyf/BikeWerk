const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

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
        console.log('🚀 Starting Admin Bot Fix Deployment...');
        
        // Connect to server
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // Upload AdminBotService.js
        console.log('📂 Uploading updated AdminBotService.js...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/AdminBotService.js'),
            `${config.remoteBase}/telegram-bot/AdminBotService.js`
        );
        console.log('✅ File uploaded');

        // Restart bots
        console.log('🔄 Restarting services...');
        await ssh.execCommand('pm2 restart all');
        console.log('✅ Services restarted');

        console.log('✨ Deployment Complete! The /clear_all command should now handle directories.');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
    } finally {
        ssh.dispose();
    }
}

deploy();
