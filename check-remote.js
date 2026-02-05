const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Connected to server\n');
    
    const cmd = `
echo "=== DB BIKE COUNT ===" &&
cd /root/eubike/backend &&
node -e "const db = require('better-sqlite3')('./database/eubike.db'); console.log('Bikes in DB:', db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);" &&
echo "" &&
echo "=== FRONTEND FILES ===" &&
ls -la /root/eubike/frontend/dist/ &&
echo "" &&
echo "=== CHECK NEW DESIGN (SniperAnalysis) ===" &&
grep -l "Выгодная цена" /root/eubike/frontend/dist/assets/*.js 2>/dev/null && echo "✅ New SniperAnalysis found" || echo "❌ New SniperAnalysis NOT found" &&
echo "" &&
echo "=== CHECK SELLER BLOCK ===" &&
grep -l "Продаёт:" /root/eubike/frontend/dist/assets/*.js 2>/dev/null && echo "✅ New Seller block found" || echo "❌ New Seller block NOT found" &&
echo "" &&
echo "=== SERVER.JS CRON ===" &&
grep "5 \\* \\* \\* \\*" /root/eubike/backend/server.js && echo "✅ Hourly cron found" || echo "❌ Hourly cron NOT found" &&
echo "" &&
echo "=== PM2 STATUS ===" &&
pm2 list
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n✅ Check complete');
            conn.end();
        });
    });
}).on('error', err => {
    console.error('Connection error:', err.message);
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
