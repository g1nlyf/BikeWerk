const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');
const ARCHIVE_PATH = path.join(PROJECT_ROOT, 'deploy_full.zip');

const config = {
  host: '45.9.41.232',
  port: 22,
  username: 'root',
  remoteZip: '/root/deploy_full.zip',
  remoteDir: '/root/eubike'
};

function getPassword() {
  const fromEnv = process.env.EUBIKE_DEPLOY_PASSWORD?.trim();
  if (fromEnv) return fromEnv;

  if (!fs.existsSync(PASS_FILE)) {
    throw new Error('Missing deploy password. Set EUBIKE_DEPLOY_PASSWORD or create deploy_password.txt');
  }

  const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
  if (!pass || pass.includes('PASTE_YOUR_ROOT_PASSWORD_HERE')) {
    throw new Error('deploy_password.txt is empty or contains placeholder content');
  }

  return pass;
}

function buildFrontend() {
  console.log('🏗️ Building frontend...');
  execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });
}

function createFullArchive() {
  console.log('📦 Creating full project archive...');

  const includeRootEntries = [
    'backend',
    'frontend',
    'telegram-bot',
    'client-telegram-bot',
    'manager-bot',
    'hot-deals-bot',
    'scripts',
    'public',
    'images',
    'database',
    'docs',
    'ssl',
    'infinite-runner',
    '.env',
    '.env.example',
    '.gitignore',
    'package.json',
    'README.md',
    'ecosystem.config.js',
    'setup-server.sh',
    'AGENTS.md'
  ];

  const excludePatterns = [
    '**/.git/**',
    '**/.github/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/.cursor/**',
    '**/.codex/**',
    '**/.agents/**',
    '**/.trae/**',
    '**/*.log',
    '**/logs/**',
    '**/test-results/**',
    '**/test-outputs/**',
    '**/tmp/**',
    '**/*.tmp',
    '**/deploy_full.zip',
    '**/deploy_delta.zip',
    'deploy_password.txt',
    'backend/database/*.db-shm',
    'backend/database/*.db-wal'
  ];

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(ARCHIVE_PATH);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const sizeMb = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ Archive created: ${sizeMb} MB`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);

    for (const entry of includeRootEntries) {
      const fullPath = path.join(PROJECT_ROOT, entry);
      if (!fs.existsSync(fullPath)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        archive.glob('**/*', {
          cwd: fullPath,
          ignore: excludePatterns,
          dot: true,
          nodir: true
        }, { prefix: `${entry}/` });
      } else {
        archive.file(fullPath, { name: entry });
      }
    }

    archive.finalize();
  });
}

function connectSsh(password) {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password
      });
  });
}

function execRemote(conn, cmd, timeout = 600000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Remote command timeout: ${cmd}`));
      }, timeout);

      stream
        .on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) return resolve({ stdout, stderr, code });
          reject(new Error(`Command failed (${code}): ${cmd}\n${stderr || stdout}`));
        })
        .on('data', (d) => { stdout += d.toString(); });

      stream.stderr.on('data', (d) => { stderr += d.toString(); });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, {}, (putErr) => {
        if (putErr) return reject(putErr);
        resolve();
      });
    });
  });
}

async function deployFull() {
  const password = getPassword();
  buildFrontend();
  await createFullArchive();

  console.log('🔐 Connecting to server...');
  const conn = await connectSsh(password);

  try {
    console.log('⬆️ Uploading archive...');
    await uploadFile(conn, ARCHIVE_PATH, config.remoteZip);

    console.log('🧹 Wiping remote project...');
    await execRemote(conn, 'pm2 delete all || true');
    await execRemote(conn, `rm -rf ${config.remoteDir} && mkdir -p ${config.remoteDir}`);

    console.log('📂 Extracting full archive...');
    await execRemote(conn, `unzip -oq ${config.remoteZip} -d ${config.remoteDir} && rm -f ${config.remoteZip}`);

    console.log('📦 Installing Node dependencies...');
    const runtimeProjects = [
      `${config.remoteDir}/backend`,
      `${config.remoteDir}/telegram-bot`,
      `${config.remoteDir}/client-telegram-bot`,
      `${config.remoteDir}/manager-bot`,
      `${config.remoteDir}/hot-deals-bot`
    ];
    for (const projectDir of runtimeProjects) {
      await execRemote(
        conn,
        `if [ -f ${projectDir}/package.json ]; then cd ${projectDir} && (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund); fi`,
        1200000
      );
    }

    console.log('🗂️ Publishing frontend dist...');
    await execRemote(conn, 'rm -rf /var/www/html/*');
    await execRemote(conn, `cp -r ${config.remoteDir}/frontend/dist/* /var/www/html/`);
    await execRemote(conn, 'chown -R www-data:www-data /var/www/html');

    console.log('🛠️ Running migrations...');
    await execRemote(conn, `cd ${config.remoteDir}/backend && node scripts/migrate_catalog_columns.js || true`);

    console.log('🔄 Restarting PM2...');
    await execRemote(conn, `cd ${config.remoteDir} && pm2 startOrReload ecosystem.config.js --update-env`);

    console.log('🩺 Verifying backend health...');
    await execRemote(
      conn,
      "for i in 1 2 3 4 5 6 7 8 9 10; do code=$(curl -s -o /tmp/api-health.out -w '%{http_code}' http://127.0.0.1:8082/api/health || true); if [ \"$code\" = \"200\" ]; then cat /tmp/api-health.out; exit 0; fi; sleep 2; done; echo 'Health check failed'; exit 1"
    );

    const pm2Status = await execRemote(conn, 'pm2 status');
    console.log('✅ Full redeploy completed.\n');
    console.log(pm2Status.stdout);
  } finally {
    conn.end();
    if (fs.existsSync(ARCHIVE_PATH)) {
      fs.unlinkSync(ARCHIVE_PATH);
    }
  }
}

deployFull().catch((err) => {
  console.error(`❌ Full redeploy failed: ${err.message}`);
  process.exit(1);
});
