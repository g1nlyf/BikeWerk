const { Client } = require('ssh2');

const config = {
  host: '45.9.41.232',
  port: 22,
  username: 'root',
  password: '&9&%4q6631vI',
};

const conn = new Client();

console.log('Connecting to remote server for lightweight cleanup...');

conn
  .on('ready', () => {
    console.log('✅ SSH connected. Running temp/cache cleanup...\n');

    const cmd = `
      set -e
      echo "=== BEFORE DISK USAGE (df -h /root) ==="
      df -h /root || df -h
      echo ""
      echo "=== Cleaning caches and temp ==="
      rm -rf /root/.npm/_cacache 2>/dev/null || true
      rm -rf /root/.cache 2>/dev/null || true
      rm -rf /tmp/* 2>/dev/null || true
      rm -rf /var/tmp/* 2>/dev/null || true
      find /root/eubike -maxdepth 1 -type f -name "deploy*.zip" -delete 2>/dev/null || true
      echo ""
      echo "=== AFTER DISK USAGE (df -h /root) ==="
      df -h /root || df -h
      echo ""
    `;

    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream
        .on('close', (code) => {
          console.log(`\n🎁 Cleanup finished with code ${code}`);
          conn.end();
        })
        .on('data', (data) => process.stdout.write(data))
        .stderr.on('data', (data) => process.stderr.write(data));
    });
  })
  .connect(config);

