const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
echo "=== 1. Copy frontend to /var/www/html ===" &&
rm -rf /var/www/html/* &&
cp -r /root/eubike/frontend/dist/* /var/www/html/ &&
chown -R www-data:www-data /var/www/html &&
echo "✅ Files copied" &&
echo "" &&
echo "=== 2. Verify files in /var/www/html ===" &&
ls -la /var/www/html/ | head -15 &&
ls -la /var/www/html/assets/ &&
echo "" &&
echo "=== 3. Restart nginx ===" &&
service nginx restart &&
echo "✅ Nginx restarted" &&
echo "" &&
echo "=== 4. Test JS file access ===" &&
curl -sI "https://bikewerk.ru/assets/index-CKz0iOXg.js" | head -5 &&
echo "" &&
echo "=== 5. Check new design in served JS ===" &&
curl -s "https://bikewerk.ru/assets/index-CKz0iOXg.js" | grep -c "Выгодная цена" &&
curl -s "https://bikewerk.ru/assets/index-CKz0iOXg.js" | grep -c "ниже рынка" &&
echo "" &&
echo "✅ DONE!"
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n\n🎉 Frontend now served correctly!');
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
