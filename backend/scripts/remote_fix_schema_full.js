const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Applying Comprehensive Schema Fix...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    const cmd = `
        cd /root/eubike/backend
        node -e "
            const { DatabaseManager } = require('./src/js/mysql-config');
            (async () => {
                const db = new DatabaseManager();
                await db.initialize();
                console.log('🔌 DB Connected');

                // 1. Fix 'bikes' table columns
                try {
                    await db.query('ALTER TABLE bikes ADD COLUMN added_at DATETIME DEFAULT CURRENT_TIMESTAMP');
                    console.log('✅ Added column: bikes.added_at');
                } catch (e) {}

                // 2. Create 'user_favorites' table
                try {
                    await db.query(\`
                        CREATE TABLE IF NOT EXISTS user_favorites (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            bike_id INTEGER NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (bike_id) REFERENCES bikes(id)
                        )
                    \`);
                    console.log('✅ Created table: user_favorites');
                } catch (e) { console.error('Error creating user_favorites:', e.message); }

                // 3. Create 'currency_history' table
                try {
                    await db.query(\`
                        CREATE TABLE IF NOT EXISTS currency_history (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            currency_pair TEXT NOT NULL,
                            rate REAL NOT NULL,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    \`);
                    console.log('✅ Created table: currency_history');
                } catch (e) { console.error('Error creating currency_history:', e.message); }

                // 4. Create/Fix 'system_logs' table
                try {
                    await db.query(\`
                        CREATE TABLE IF NOT EXISTS system_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            level TEXT NOT NULL,
                            message TEXT NOT NULL,
                            meta TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    \`);
                    console.log('✅ Created table: system_logs');
                    
                    // Add 'stack' column if missing
                    try {
                        await db.query('ALTER TABLE system_logs ADD COLUMN stack TEXT');
                        console.log('✅ Added column: system_logs.stack');
                    } catch (e) {}
                } catch (e) { console.error('Error creating system_logs:', e.message); }

                console.log('🏁 Schema Fix Complete');
            })();
        "
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('🎁 Fix Script Finished with code ' + code);
            
            // Restart backend to clear caches/errors
            conn.exec('pm2 restart eubike-backend', (err, stream) => {
                stream.on('close', () => conn.end());
            });
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
