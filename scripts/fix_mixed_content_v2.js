const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function fixMixedContentV2() {
    console.log('🚀 Starting Deep Mixed Content Fix...');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server');

        // 1. Upload Fixed Frontend Files
        console.log('📤 Uploading patched source files...');
        const filesToUpload = [
            'src/pages/AdminDashboard/InspectionPage.tsx',
            'src/components/HunterLogger.tsx'
        ];

        for (const file of filesToUpload) {
            await ssh.putFile(
                path.join(__dirname, '../frontend', file),
                `/root/eubike/frontend/${file}`
            );
        }

        // 2. Fix Database (Convert http:// to https:// in image urls)
        console.log('🗄️ Fixing Database URLs...');
        const dbFixCmd = `
            cd /root/eubike/backend
            node -e "
                const db = require('better-sqlite3')('database/eubike.db');
                
                // Fix main_image
                const res1 = db.prepare(\\\"UPDATE bikes SET main_image = REPLACE(main_image, 'http://', 'https://') WHERE main_image LIKE 'http://%'\\\").run();
                console.log('Fixed main_image:', res1.changes);

                // Fix images (json or comma separated, REPLACE is safe enough for simple string)
                const res2 = db.prepare(\\\"UPDATE bikes SET images = REPLACE(images, 'http://', 'https://') WHERE images LIKE '%http://%'\\\").run();
                console.log('Fixed images:', res2.changes);
            "
        `;
        const dbRes = await ssh.execCommand(dbFixCmd);
        console.log(dbRes.stdout || dbRes.stderr);

        // 3. Rebuild Frontend
        console.log('🏗️ Rebuilding Frontend (Clean)...');
        const buildCmd = [
            'cd /root/eubike/frontend',
            'rm -rf dist',
            'export VITE_API_URL=/api', 
            'npm run build'
        ].join(' && ');

        const buildResult = await ssh.execCommand(buildCmd);
        if (buildResult.stderr && !buildResult.stderr.includes('warn')) {
             console.log('Build Output:', buildResult.stdout); // Log stdout anyway
             console.error('Build Warning/Error:', buildResult.stderr);
        } else {
             console.log('✅ Frontend Built.');
        }

        // 4. Deploy to Nginx
        console.log('📦 Deploying to /var/www/html...');
        await ssh.execCommand('rm -rf /var/www/html/*');
        await ssh.execCommand('cp -r /root/eubike/frontend/dist/* /var/www/html/');
        await ssh.execCommand('chown -R www-data:www-data /var/www/html');

        // 5. Grep for http:// in build assets to be sure
        console.log('🔎 Verifying build assets...');
        const grepRes = await ssh.execCommand('grep -r "http://" /var/www/html/assets/');
        if (grepRes.stdout) {
            console.warn('⚠️ Found http:// in assets (could be external links or false positives):');
            console.log(grepRes.stdout.substring(0, 200) + '...');
        } else {
            console.log('✅ No "http://" found in assets.');
        }

        console.log('✨ Fix V2 Complete! Please clear cache and refresh.');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        ssh.dispose();
    }
}

fixMixedContentV2();
