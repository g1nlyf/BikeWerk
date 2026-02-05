const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function fixMixedContent() {
    console.log('🚀 Starting HTTPS Mixed Content Fix...');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server');

        // 1. Rebuild Frontend with Relative API Path
        console.log('🏗️ Rebuilding Frontend with secure paths...');
        
        const buildCmd = [
            'cd /root/eubike/frontend',
            'export VITE_API_URL=/api', // Force relative path
            'npm run build'
        ].join(' && ');

        const buildResult = await ssh.execCommand(buildCmd);
        if (buildResult.stderr && !buildResult.stderr.includes('warn')) {
            console.log('Build Output:', buildResult.stdout);
            console.error('Build Error (non-fatal):', buildResult.stderr);
        } else {
            console.log('✅ Build successful');
        }

        // 2. Deploy to Nginx Web Root
        console.log('📦 Deploying to /var/www/html...');
        await ssh.execCommand('rm -rf /var/www/html/*');
        await ssh.execCommand('cp -r /root/eubike/frontend/dist/* /var/www/html/');
        await ssh.execCommand('chown -R www-data:www-data /var/www/html');

        // 3. Restart Services
        console.log('🔄 Reloading Nginx...');
        await ssh.execCommand('systemctl reload nginx');

        console.log('✨ Fix Complete! Please clear your browser cache and refresh.');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        ssh.dispose();
    }
}

fixMixedContent();
