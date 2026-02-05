const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    // Step 1: Stop Backend
    console.log('🛑 Stopping remote backend...');
    conn.exec('pm2 stop eubike-backend', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Backend stopped.');
            
            // Step 2: Delete DB
            console.log('🗑️ Deleting remote DB...');
            conn.exec('rm -f /root/eubike/backend/database/eubike.db', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('✅ DB Deleted.');
                    
                    // Step 3: Start Backend
                    console.log('🚀 Starting remote backend (fresh DB)...');
                    conn.exec('pm2 start eubike-backend', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', (code) => {
                            console.log('✅ Remote backend started. Code:', code);
                            conn.end();
                        });
                    });
                });
            });
        });
    });
}).connect(config);
