const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    // Simply restart and verify
    const cmd = `
echo "=== Clearing nginx cache ===" &&
rm -rf /var/cache/nginx/* 2>/dev/null || true &&
echo "" &&
echo "=== Restarting services ===" &&
cd /root/eubike &&
pm2 restart eubike-backend &&
service nginx restart &&
sleep 3 &&
echo "" &&
echo "=== VERIFICATION ===" &&
echo "DB Bikes:" &&
node -e "const db=require('better-sqlite3')('./backend/database/eubike.db');console.log(db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);" &&
echo "" &&
echo "Frontend assets:" &&
ls -la /root/eubike/frontend/dist/assets/*.js 2>/dev/null | head -3 &&
echo "" &&
echo "Test API:" &&
curl -s "http://localhost:8082/api/catalog/bikes?limit=2" | head -c 300 &&
echo "" &&
echo "" &&
pm2 list
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
