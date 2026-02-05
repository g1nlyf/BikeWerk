const { Client } = require('ssh2');
const config = { host: '45.9.41.232', port: 22, username: 'root', password: '&9&%4q6631vI' };
const conn = new Client();

console.log('🧹 STARTING EMERGENCY CLEANUP...');

conn.on('ready', () => {
    const cmd = `
        echo "--- Disk Usage Before ---"
        df -h
        
        echo "--- Cleaning NPM Cache ---"
        npm cache clean --force
        rm -rf /root/.npm/_logs/*
        
        echo "--- Cleaning Temp Files ---"
        rm -rf /tmp/*
        
        echo "--- Checking Large Files ---"
        du -ah /root/eubike | sort -rh | head -n 10
        
        echo "--- Disk Usage After ---"
        df -h
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`\n✅ Cleanup finished with code ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        });
    });
}).connect(config);