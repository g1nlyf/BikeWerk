const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Investigating Remote Population...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    // Check if the script exists and run it again with logging capture
    const cmd = `
        echo "=== 1. Check Files Existence ==="
        ls -l /root/eubike/backend/tests/debug/full_json_dump_10.json
        ls -l /root/eubike/backend/scripts/populate_from_dump.js
        
        echo "\n=== 2. Re-Run Population with Debugging ==="
        cd /root/eubike/backend
        # Ensure dependencies are installed for the script (axios, etc.)
        npm install axios https-proxy-agent
        
        echo "--> Running script..."
        node scripts/populate_from_dump.js
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('🎁 Investigation Finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
