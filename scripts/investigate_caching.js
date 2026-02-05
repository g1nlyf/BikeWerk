#!/usr/bin/env node
/**
 * Check what's happening with caching on production
 */

const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🔍 Investigating Caching Issue\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Check Nginx cache headers for static files
        console.log('1️⃣ Checking Nginx configuration for cache headers:');
        const nginxConfig = await ssh.execCommand('cat /etc/nginx/sites-available/bikewerk.ru | grep -A 10 "location.*dist\\|location.*assets\\|Cache-Control\\|expires"');
        console.log(nginxConfig.stdout || '(no cache config found)');
        console.log('');

        // 2. Check if AuthDialog still exists in dist on server
        console.log('2️⃣ Searching for AuthDialog in deployed dist:');
        const authDialogSearch = await ssh.execCommand('grep -r "AuthDialog" /root/eubike/frontend/dist/*.js 2>&1 | head -5');
        console.log(authDialogSearch.stdout || '(not found - good!)');
        console.log('');

        // 3. Check deployed JS bundle names and sizes
        console.log('3️⃣ Deployed JS bundles:');
        const bundles = await ssh.execCommand('ls -lh /root/eubike/frontend/dist/assets/*.js');
        console.log(bundles.stdout);
        console.log('');

        // 4. Get latest index.html to see what JS is loaded
        console.log('4️⃣ Checking index.html script references:');
        const indexHtml = await ssh.execCommand('grep -E "<script.*src=|<link.*href=" /root/eubike/frontend/dist/index.html');
        console.log(indexHtml.stdout);
        console.log('');

        console.log('✅ Investigation complete');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
