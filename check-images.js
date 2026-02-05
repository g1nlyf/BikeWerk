const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = fs.readFileSync(path.join(__dirname, 'deploy_password.txt'), 'utf8').trim();

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected\n');
    
    const cmd = `
cd /root/eubike/backend &&
echo "=== All bikes with their main_image ===" &&
node -e "
const db = require('better-sqlite3')('./database/eubike.db');
const bikes = db.prepare('SELECT id, brand, model, main_image FROM bikes').all();
bikes.forEach(b => {
    const hasImage = b.main_image && b.main_image.includes('imagekit');
    console.log(\\\`[\\\${b.id}] \\\${hasImage ? '✓' : '✗'} \\\${b.brand} \\\${b.model}\\\`);
    console.log(\\\`    main_image: \\\${b.main_image ? b.main_image.substring(0,80) + '...' : 'NULL'}\\\`);
});
" &&
echo "" &&
echo "=== Bike images table ===" &&
node -e "
const db = require('better-sqlite3')('./database/eubike.db');
const images = db.prepare('SELECT bike_id, COUNT(*) as cnt, GROUP_CONCAT(SUBSTR(local_path, 1, 50)) as paths FROM bike_images GROUP BY bike_id').all();
images.forEach(i => {
    console.log(\\\`Bike \\\${i.bike_id}: \\\${i.cnt} images\\\`);
    console.log(\\\`  Paths: \\\${i.paths}\\\`);
});
"
`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('\n✅ Done');
            conn.end();
        });
    });
}).connect({
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: pass
});
