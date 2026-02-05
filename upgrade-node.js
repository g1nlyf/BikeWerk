const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    
    // Commands:
    // 1. Remove old node
    // 2. Setup Node 22 repo
    // 3. Install Node 22
    // 4. Verify version
    // 5. Rebuild modules
    // 6. Restart PM2
    
    const cmd = `
        export DEBIAN_FRONTEND=noninteractive
        echo "Removing old node..."
        apt-get remove -y nodejs libnode* || true
        apt-get autoremove -y || true
        
        echo "Setting up Node 22..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        
        echo "Installing Node 22..."
        apt-get install -y nodejs
        
        echo "New Node Version:"
        node -v
        
        echo "Rebuilding Backend..."
        cd /root/eubike/backend
        npm rebuild
        
        echo "Rebuilding Bot..."
        cd /root/eubike/telegram-bot
        npm rebuild
        
        echo "Restarting PM2..."
        pm2 restart all
        
        echo "Checking Bot Logs..."
        sleep 5
        pm2 logs eubike-bot --lines 20 --nostream
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect(config);
