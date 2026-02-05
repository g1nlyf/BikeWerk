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
        console.log('🚀 Starting Gemini Fix Deployment...');
        
        // Connect to server
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected via SSH');

        // 1. Update .env
        console.log('📂 Uploading .env...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/.env'),
            `${config.remoteBase}/telegram-bot/.env`
        );
        console.log('✅ .env updated');

        // 2. Upload TS file (for reference/future builds)
        console.log('📂 Uploading geminiClient.ts...');
        await ssh.putFile(
            path.join(config.localBase, 'telegram-bot/autocat-klein/src/lib/geminiClient.ts'),
            `${config.remoteBase}/telegram-bot/autocat-klein/src/lib/geminiClient.ts`
        );
        console.log('✅ geminiClient.ts updated');

        console.log('🛠️ Patching compiled JS on server...');
        const jsPath = `${config.remoteBase}/telegram-bot/autocat-klein/dist/autocat-klein/src/lib/geminiClient.js`;
        
        // Read the file from server
        const remoteJs = await ssh.execCommand(`cat ${jsPath}`);
        if (remoteJs.stdout) {
            let jsContent = remoteJs.stdout;
            const newModels = `this.MODELS = [
            'gemini-2.5-flash'
        ];`;
            
            const regex = /this\.MODELS\s*=\s*\[[\s\S]*?\];/;
            jsContent = jsContent.replace(regex, newModels);
            await ssh.execCommand(`echo "${jsContent.replace(/"/g, '\\"').replace(/`/g, '\\`')}" > ${jsPath}.tmp`);
            fs.writeFileSync('temp_geminiClient.js', jsContent);
            await ssh.putFile('temp_geminiClient.js', jsPath);
            fs.unlinkSync('temp_geminiClient.js');
            console.log('✅ Compiled JS patched');
        } else {
             console.error('❌ Failed to read remote JS file');
        }

        // Restart bots
        console.log('🔄 Restarting services...');
        await ssh.execCommand('pm2 restart all');
        console.log('✅ Services restarted');

        console.log('✨ Deployment Complete! Gemini 404/400 errors should be resolved.');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
    } finally {
        ssh.dispose();
    }
}

deploy();
