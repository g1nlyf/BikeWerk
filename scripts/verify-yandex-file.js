const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, '../deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
echo "=== 1. Check if file exists in frontend/dist ===" &&
ls -la /root/eubike/frontend/dist/yandex_60c7110c85d8dcf3.html &&
echo "" &&
echo "=== 2. Copy to /var/www/html ===" &&
cp /root/eubike/frontend/dist/yandex_60c7110c85d8dcf3.html /var/www/html/ &&
chown www-data:www-data /var/www/html/yandex_60c7110c85d8dcf3.html &&
echo "✅ File copied" &&
echo "" &&
echo "=== 3. Verify file in /var/www/html ===" &&
ls -la /var/www/html/yandex_60c7110c85d8dcf3.html &&
echo "" &&
echo "=== 4. Check file content ===" &&
cat /var/www/html/yandex_60c7110c85d8dcf3.html &&
echo "" &&
echo "=== 5. Test HTTP access ===" &&
curl -sI "https://bikewerk.ru/yandex_60c7110c85d8dcf3.html" | head -5 &&
echo "" &&
echo "=== 6. Test file content via HTTP ===" &&
curl -s "https://bikewerk.ru/yandex_60c7110c85d8dcf3.html"
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n✅ Verification complete');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
