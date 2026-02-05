const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, '../deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
echo "=== 1. Check SEO files in /var/www/html ===" &&
ls -la /var/www/html/robots.txt /var/www/html/sitemap.xml /var/www/html/yandex_60c7110c85d8dcf3.html 2>&1 &&
echo "" &&
echo "=== 2. Check index.html meta tags ===" &&
grep -o '<title>.*</title>' /var/www/html/index.html &&
grep -o 'meta name="description".*' /var/www/html/index.html | head -1 &&
echo "" &&
echo "=== 3. Test HTTP access to SEO files ===" &&
echo "robots.txt:" &&
curl -sI "https://bikewerk.ru/robots.txt" | head -3 &&
echo "" &&
echo "sitemap.xml:" &&
curl -sI "https://bikewerk.ru/sitemap.xml" | head -3 &&
echo "" &&
echo "yandex verification:" &&
curl -sI "https://bikewerk.ru/yandex_60c7110c85d8dcf3.html" | head -3 &&
echo "" &&
echo "=== 4. Check robots.txt content ===" &&
curl -s "https://bikewerk.ru/robots.txt" &&
echo "" &&
echo "" &&
echo "=== 5. Check sitemap.xml content ===" &&
curl -s "https://bikewerk.ru/sitemap.xml" | head -15
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n✅ SEO verification complete');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
