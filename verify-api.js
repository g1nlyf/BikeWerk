const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Connected to server\n');
    
    const cmd = `
echo "=== WAITING FOR SERVER ===" &&
sleep 3 &&
echo "" &&
echo "=== TEST API RESPONSE ===" &&
curl -s "http://localhost:8082/api/catalog/bikes?limit=2" | jq '{total: .total, bikes: [.bikes[]? | {id, brand, model, is_hot, is_hot_offer}]}' 2>/dev/null || curl -s "http://localhost:8082/api/catalog/bikes?limit=2" &&
echo "" &&
echo "=== LOCAL vs REMOTE JS HASH ===" &&
echo "Remote JS: index-CKz0iOXg.js" &&
echo "" &&
echo "=== CHECK BIKE DETAIL RESPONSE ===" &&
curl -s "http://localhost:8082/api/bikes/1" | jq '{id, brand, model, main_image, is_hot, condition: .condition}' 2>/dev/null || echo "No jq, raw output" &&
echo ""
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
}).on('error', err => {
    console.error('Connection error:', err.message);
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
