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
        console.log('🚀 Deploying Gemini Client with Proxy Support...');
        
        // Connect to server
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // Upload geminiClient.js
        console.log('📂 Uploading geminiClient.js...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/autocat-klein/dist/autocat-klein/src/lib/geminiClient.js'),
            `${config.remoteBase}/telegram-bot/autocat-klein/dist/autocat-klein/src/lib/geminiClient.js`
        );
        
        // Upload bot.js (ensure gemini-2.5-flash URL is set as requested)
        console.log('📂 Uploading bot.js...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/bot.js'),
            `${config.remoteBase}/telegram-bot/bot.js`
        );

        // Restart bots
        console.log('🔄 Restarting services...');
        await ssh.execCommand('pm2 restart all');
        console.log('✅ Services restarted');

        console.log('✨ Deployment Complete! Proxy support added.');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
    } finally {
        ssh.dispose();
    }
}

deploy();
