const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('Connecting to remote server...');

conn.on('ready', () => {
  console.log('✅ Client :: ready');
  
  const cmd = `
    echo "=== 1. PORT 8082 STATUS ==="
    netstat -tulpn | grep 8082 || echo "❌ Port 8082 not found in netstat"

    echo "\n=== 2. API HEALTH CHECK (Internal) ==="
    curl -v http://localhost:8082/api/health 2>&1 || echo "❌ Curl failed"

    echo "\n=== 3. DATABASE FILE STATUS ==="
    ls -l /root/eubike/backend/database/eubike.db
    
    echo "\n=== 4. DATABASE FILE LOCKS ==="
    fuser /root/eubike/backend/database/eubike.db || echo "No active locks detected"
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('🎁 Remote commands executed. Exit code:', code);
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.error('STDERR:', data.toString());
    });
  });
}).connect(config);
