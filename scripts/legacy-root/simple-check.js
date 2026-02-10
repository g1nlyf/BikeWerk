const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
cd /root/eubike/frontend/dist/assets &&
echo "=== Limit 500 ===" &&
grep -c "limit.*500" *.js 2>/dev/null || echo "0" &&
echo "" &&
echo "=== ниже рынка ===" &&
grep -c "ниже рынка" *.js 2>/dev/null || echo "0" &&
echo "" &&
echo "=== Выгодная цена ===" &&
grep -c "Выгодная цена" *.js 2>/dev/null || echo "0" &&
echo "" &&
echo "=== Индикаторы износа ===" &&
grep -c "Индикаторы износа" *.js 2>/dev/null || echo "0" &&
echo "" &&
echo "=== Продаёт ===" &&
grep -c "Продаёт" *.js 2>/dev/null || echo "0" &&
echo "" &&
echo "=== emerald ===" &&
grep -c "emerald" *.js 2>/dev/null || echo "0"
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('data', d => { output += d.toString(); });
        stream.stderr.on('data', d => { output += d.toString(); });
        stream.on('close', () => {
            console.log(output);
            console.log('\nDone');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
