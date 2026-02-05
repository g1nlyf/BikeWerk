const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

// Configuration (use env to avoid leaking secrets)
const config = {
    host: process.env.DEPLOY_HOST,
    username: process.env.DEPLOY_USER || 'root',
    password: process.env.DEPLOY_PASSWORD,
    remoteBase: process.env.DEPLOY_REMOTE_BASE || '/root/eubike',
    localBase: process.env.DEPLOY_LOCAL_BASE || path.resolve(__dirname, '..')
};

const PROXY_STRING =
    process.env.EUBIKE_PROXY_URL ||
    process.env.HUNTER_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.PROXY_URL ||
    '';

async function deploy() {
    try {
        if (!config.host || !config.password) {
            console.error('Missing DEPLOY_HOST or DEPLOY_PASSWORD env vars.');
            process.exit(1);
        }
        if (!PROXY_STRING) {
            console.error('Missing proxy env (EUBIKE_PROXY_URL/HUNTER_PROXY_URL/HTTPS_PROXY).');
            process.exit(1);
        }
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
