const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Connected to server\n');
    
    const cmd = `
echo "=== RESTARTING NGINX ===" &&
service nginx restart &&
echo "✅ Nginx restarted" &&
echo "" &&
echo "=== RESTARTING PM2 ===" &&
cd /root/eubike &&
pm2 restart eubike-backend &&
echo "" &&
echo "=== CHECKING INDEX.HTML HASH ===" &&
md5sum /root/eubike/frontend/dist/index.html &&
echo "" &&
echo "=== CHECKING MAIN JS HASH ===" &&
ls -la /root/eubike/frontend/dist/assets/*.js &&
echo "" &&
echo "=== VERIFY API WORKING ===" &&
curl -s http://localhost:8082/api/catalog/bikes?limit=1 | head -c 500 &&
echo "" &&
echo "" &&
echo "=== FINAL PM2 STATUS ===" &&
pm2 list
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n\n✅ All done! Please hard refresh (Ctrl+Shift+R) in browser.');
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
