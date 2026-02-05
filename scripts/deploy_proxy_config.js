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

const PROXY_STRING = 'http://user258350:otuspk@191.101.73.161:8984';

async function deploy() {
    try {
        console.log('🚀 Configuring Gemini Proxy...');
        
        // Connect to server
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // 1. Update .env file
        console.log('📝 Updating .env with GEMINI_PROXY...');
        // Remove existing GEMINI_PROXY if any, then append new one
        const updateEnvCmd = `
            sed -i '/GEMINI_PROXY/d' ${config.remoteBase}/telegram-bot/.env && \
            echo "GEMINI_PROXY=${PROXY_STRING}" >> ${config.remoteBase}/telegram-bot/.env
        `;
        await ssh.execCommand(updateEnvCmd);

        // 2. Upload modified geminiClient.js
        console.log('📂 Uploading updated geminiClient.js...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/autocat-klein/dist/autocat-klein/src/lib/geminiClient.js'),
            `${config.remoteBase}/telegram-bot/autocat-klein/dist/autocat-klein/src/lib/geminiClient.js`
        );

        // 3. Upload and run test script
        console.log('📂 Uploading test_gemini_proxy.js...');
        await ssh.putFile(
            path.join(config.localBase, 'scripts/test_gemini_proxy.js'),
            `${config.remoteBase}/scripts/test_gemini_proxy.js`
        );

        console.log('🧪 Running Proxy Test...');
        const testResult = await ssh.execCommand('node scripts/test_gemini_proxy.js', { cwd: config.remoteBase });
        console.log('\n--- TEST OUTPUT ---');
        console.log(testResult.stdout);
        console.log(testResult.stderr);
        console.log('-------------------\n');

        if (testResult.stdout.includes('Success!')) {
            console.log('✅ Test Passed! Restarting services...');
            await ssh.execCommand('pm2 restart all');
            console.log('🔄 Services restarted.');
        } else {
            console.warn('⚠️ Test Failed or inconclusive. Services NOT restarted automatically.');
        }

    } catch (error) {
        console.error('❌ Deployment failed:', error);
    } finally {
        ssh.dispose();
    }
}

deploy();
