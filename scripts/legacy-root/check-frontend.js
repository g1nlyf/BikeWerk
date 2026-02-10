const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Connected to server\n');
    
    const cmd = `
echo "=== CHECK FRONTEND LIMIT ===" &&
grep -o "limit.*500" /root/eubike/frontend/dist/assets/*.js && echo "✅ Limit 500 found" || echo "❌ Limit 500 NOT found" &&
echo "" &&
echo "=== CHECK FRONTEND 'hot' FILTER ===" &&
grep -o "isHotFilter" /root/eubike/frontend/dist/assets/*.js | head -3 && echo "✅ isHotFilter found" || echo "Warning" &&
echo "" &&
echo "=== SEARCH FOR OLD 100 LIMIT ===" &&
grep -o "limit.*100" /root/eubike/frontend/dist/assets/*.js | head -3 || echo "No old limit 100 found" &&
echo "" &&
echo "=== CHECK NEW DESIGN KEYWORDS ===" &&
echo "Checking for 'ниже рынка':" &&
grep -c "ниже рынка" /root/eubike/frontend/dist/assets/*.js || echo "0" &&
echo "" &&
echo "Checking for 'Выгодная цена':" &&
grep -c "Выгодная цена" /root/eubike/frontend/dist/assets/*.js || echo "0" &&
echo "" &&
echo "Checking for 'emerald-600' (new color):" &&
grep -c "emerald-600" /root/eubike/frontend/dist/assets/*.js || echo "0" &&
echo "" &&
echo "Checking for 'Индикаторы износа':" &&
grep -c "Индикаторы износа" /root/eubike/frontend/dist/assets/*.js || echo "0"
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
