const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
echo "=== 1. What JS is being served by nginx? ===" &&
curl -sI "https://bikewerk.ru/assets/index-CKz0iOXg.js" | head -10 &&
echo "" &&
echo "=== 2. Check nginx config ===" &&
cat /etc/nginx/sites-enabled/bikewerk.ru 2>/dev/null | head -40 || cat /etc/nginx/sites-enabled/default | head -40 &&
echo "" &&
echo "=== 3. Files in frontend/dist/assets ===" &&
ls -la /root/eubike/frontend/dist/assets/ &&
echo "" &&
echo "=== 4. Check index.html references ===" &&
grep -o 'assets/[^"]*\\.js' /root/eubike/frontend/dist/index.html &&
echo "" &&
echo "=== 5. Check NEW design in deployed JS ===" &&
grep -c "emerald-600" /root/eubike/frontend/dist/assets/*.js &&
grep -c "Выгодная цена" /root/eubike/frontend/dist/assets/*.js &&
grep -c "ниже рынка" /root/eubike/frontend/dist/assets/*.js &&
echo "" &&
echo "=== 6. Check if OLD design exists ===" &&
grep -c "Sniper Analysis" /root/eubike/frontend/dist/assets/*.js || echo "0" &&
grep -c "11% below" /root/eubike/frontend/dist/assets/*.js || echo "0" &&
echo "" &&
echo "=== 7. Nginx cache status ===" &&
ls -la /var/cache/nginx/ 2>/dev/null || echo "No nginx cache dir" &&
echo "" &&
echo "=== 8. PM2 logs (last 10 lines) ===" &&
pm2 logs eubike-backend --lines 5 --nostream 2>&1 | tail -15
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n✅ Debug complete');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
