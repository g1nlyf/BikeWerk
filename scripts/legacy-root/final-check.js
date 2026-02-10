const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
echo "=== Database ===" &&
cd /root/eubike/backend &&
node -e "const db=require('better-sqlite3')('./database/eubike.db');console.log('Bikes:', db.prepare('SELECT COUNT(*) as c FROM bikes').get().c);" &&
echo "" &&
echo "=== Frontend assets ===" &&
ls /root/eubike/frontend/dist/assets/*.js &&
echo "" &&
echo "=== Check new design keywords in JS ===" &&
cd /root/eubike/frontend/dist/assets &&
grep -c "Выгодная цена" *.js &&
grep -c "ниже рынка" *.js &&
grep -c "Продаёт" *.js &&
echo "" &&
echo "=== API Response ===" &&
curl -s "http://localhost:8082/api/catalog/bikes?limit=2" | jq '{total, bikes: [.bikes[] | {id, brand, model, is_hot}]}' 2>/dev/null || curl -s "http://localhost:8082/api/catalog/bikes?limit=2" | head -c 400 &&
echo "" &&
echo "" &&
echo "=== PM2 Status ===" &&
pm2 list
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n✅ All checks complete!');
            console.log('Please hard refresh (Ctrl+Shift+R) the browser.');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
