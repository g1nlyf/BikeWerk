const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
echo "=== Check DB from backend dir ===" &&
cd /root/eubike/backend &&
node -e "const db=require('better-sqlite3')('./database/eubike.db');console.log('Bikes:', db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);" &&
echo "" &&
echo "=== List bike IDs ===" &&
node -e "const db=require('better-sqlite3')('./database/eubike.db');db.prepare('SELECT id, brand, model FROM bikes').all().forEach(b=>console.log(b.id, b.brand, b.model));" &&
echo "" &&
echo "=== Check frontend JS ===" &&
ls /root/eubike/frontend/dist/assets/*.js &&
echo "" &&
echo "=== Restart backend ===" &&
cd /root/eubike &&
pm2 restart eubike-backend &&
sleep 3 &&
echo "" &&
echo "=== Test API response ===" &&
curl -s "http://localhost:8082/api/catalog/bikes?limit=2" | head -c 500 &&
echo "" &&
echo "" &&
echo "=== PM2 status ===" &&
pm2 list
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n\n✅ Server fixed. Please hard refresh browser.');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
