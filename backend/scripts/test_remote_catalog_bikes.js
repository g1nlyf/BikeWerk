const { Client } = require('ssh2');

const config = {
  host: '45.9.41.232',
  port: 22,
  username: 'root',
  password: '&9&%4q6631vI',
};

const conn = new Client();

console.log('Connecting to remote server to test /api/catalog/bikes ...');

conn
  .on('ready', () => {
    console.log('✅ SSH connected. Calling backend locally...\n');

    const cmd = `
      curl -s -w "\\nSTATUS:%{http_code}\\n" "http://localhost:8082/api/catalog/bikes?sort=rank&sortOrder=DESC&limit=500&offset=0"
    `;

    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream
        .on('close', (code) => {
          console.log(`\n🎁 Remote catalog test finished with code ${code}`);
          conn.end();
        })
        .on('data', (data) => process.stdout.write(data))
        .stderr.on('data', (data) => process.stderr.write(data));
    });
  })
  .connect(config);

