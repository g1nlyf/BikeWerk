#!/usr/bin/env node
/**
 * Clean old JS chunks from production and force cache clear
 */

const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

async function main() {
    console.log('🧹 Cleaning Old Frontend Chunks\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. List current chunks
        console.log('1️⃣ Current JS chunks on server:');
        const listChunks = await ssh.execCommand('ls -lh /root/eubike/frontend/dist/assets/*.js');
        console.log(listChunks.stdout);
        console.log('');

        // 2. Remove ALL old chunks and CSS
        console.log('2️⃣ Removing ALL old assets...');
        await ssh.execCommand('rm -rf /root/eubike/frontend/dist/assets/*');
        console.log('✅ Deleted all old assets\n');

        // 3. Verify deletion
        console.log('3️⃣ Verifying deletion:');
        const verify = await ssh.execCommand('ls /root/eubike/frontend/dist/assets/ | wc -l');
        console.log(`Remaining files: ${verify.stdout.trim()}\n`);

        console.log('✅ Cleanup complete!');
        console.log('\n📝 Next: Re-deploy frontend to upload fresh chunks');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
