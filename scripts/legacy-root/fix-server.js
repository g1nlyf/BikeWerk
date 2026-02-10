const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
echo "=== Installing backend dependencies ===" &&
cd /root/eubike/backend &&
npm install better-sqlite3 --no-save 2>&1 | tail -5 &&
echo "" &&
echo "=== Check DB ===" &&
cd /root/eubike &&
node -e "const db=require('better-sqlite3')('./backend/database/eubike.db');console.log('Bikes:', db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);" &&
echo "" &&
echo "=== Check frontend JS files ===" &&
ls -la /root/eubike/frontend/dist/assets/*.js &&
echo "" &&
echo "=== Restart backend ===" &&
pm2 restart eubike-backend &&
sleep 2 &&
echo "" &&
echo "=== Test API ===" &&
curl -s "http://localhost:8082/api/catalog/bikes?limit=1" | head -c 400 &&
echo ""
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n\n✅ Done');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
