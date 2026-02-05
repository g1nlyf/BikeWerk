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
        console.log('🚀 Starting DB Fix Deployment...');
        
        // Connect to server
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // Upload bikes-database-node.js
        console.log('📂 Uploading updated database logic...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/bikes-database-node.js'),
            `${config.remoteBase}/telegram-bot/bikes-database-node.js`
        );
        console.log('✅ File uploaded');

        // Restart bots to trigger DB init
        console.log('🔄 Restarting services...');
        await ssh.execCommand('pm2 restart all');
        console.log('✅ Services restarted');

        console.log('✨ Deployment Complete! The DB should auto-migrate on startup.');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
    } finally {
        ssh.dispose();
    }
}

deploy();
