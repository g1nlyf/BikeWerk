const { Client } = require('ssh2');

const config = {
  host: '45.9.41.232',
  port: 22,
  username: 'root',
  password: '&9&%4q6631vI',
};

const conn = new Client();

console.log('Connecting to remote server to activate all bikes...');

conn
  .on('ready', () => {
    console.log('✅ SSH connected. Updating DB...\n');

    const cmd = `
      set -e
      echo "Before:"
      sqlite3 /root/backend/database/eubike.db "SELECT COUNT(*) AS total, SUM(is_active) AS active FROM bikes;";
      echo ""
      echo "Running UPDATE..."
      sqlite3 /root/backend/database/eubike.db "UPDATE bikes SET is_active = 1 WHERE 1=1;";
      echo ""
      echo "After:"
      sqlite3 /root/backend/database/eubike.db "SELECT COUNT(*) AS total, SUM(is_active) AS active FROM bikes;";
      echo ""
    `;

    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream
        .on('close', (code) => {
          console.log('\n🎁 Activation script finished with code ' + code);
          conn.end();
        })
        .on('data', (data) => process.stdout.write(data))
        .stderr.on('data', (data) => process.stderr.write(data));
    });
  })
  .connect(config);

