const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function deployAndRun() {
    console.log('🔌 Connecting to server...');
    await ssh.connect(config);
    console.log('✅ Connected.');

    const localScript = path.join(__dirname, 'balanced_fmv_collection.js');
    const localConfig = path.join(__dirname, '../config/brands-config.json');
    const remoteScript = '/root/eubike/backend/scripts/balanced_fmv_collection.js';
    const remoteConfig = '/root/eubike/backend/config/brands-config.json';

    console.log('📤 Uploading files...');
    await ssh.putFiles([
        { local: localScript, remote: remoteScript },
        { local: localConfig, remote: remoteConfig }
    ]);
    console.log('✅ Files uploaded.');

    console.log('📦 Installing dependencies on remote...');
    // Ensure we are in backend dir
    const installCmd = 'cd /root/eubike/backend && npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth better-sqlite3';
    
    // This might take a while
    const resultInstall = await ssh.execCommand(installCmd);
    console.log('STDOUT:', resultInstall.stdout);
    console.log('STDERR:', resultInstall.stderr);

    console.log('🚀 Running FMV Collection Script (nohup)...');
    
    // Ensure logs dir exists on remote
    await ssh.execCommand('mkdir -p /root/eubike/backend/logs');

    // Run with nohup
    const runCmd = 'nohup node /root/eubike/backend/scripts/balanced_fmv_collection.js > /root/eubike/backend/logs/balanced_fmv.log 2>&1 & echo $!';
    const resultRun = await ssh.execCommand(runCmd);
    const pid = resultRun.stdout.trim();
    console.log(`✅ Started process with PID: ${pid}`);
    
    console.log('📋 Waiting 15 seconds to check progress...');
    await new Promise(r => setTimeout(r, 15000));
    
    const logCmd = 'tail -n 50 /root/eubike/backend/logs/balanced_fmv.log';
    const resultLog = await ssh.execCommand(logCmd);
    console.log('--- LOGS START ---');
    console.log(resultLog.stdout);
    console.log('--- LOGS END ---');
    
    // Check if process is still running
    const checkCmd = `ps -p ${pid}`;
    const resultCheck = await ssh.execCommand(checkCmd);
    if (resultCheck.stdout.includes(pid)) {
        console.log('✅ Process is still running.');
    } else {
        console.log('⚠️ Process might have exited. Check logs above.');
    }

    ssh.dispose();
}

deployAndRun().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
