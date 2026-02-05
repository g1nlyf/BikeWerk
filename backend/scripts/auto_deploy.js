const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const glob = require('glob');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

// Config
const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    remoteDir: '/root',
    deployDir: '/root/eubike'
};

// Utils
async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    if (!pass || pass.includes('PASTE_YOUR_ROOT_PASSWORD_HERE')) {
        throw new Error('Please save the root password in deploy_password.txt');
    }
    return pass;
}

function getFileHash(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('md5');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    } catch (e) {
        return null;
    }
}

function normalizePath(p) {
    return p.split(path.sep).join('/');
}

function validateZip(filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile() || stats.size < 4) return false;
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(4);
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        const isZipSignature = buffer[0] === 0x50 && buffer[1] === 0x4b &&
            ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
             (buffer[2] === 0x05 && buffer[3] === 0x06) ||
             (buffer[2] === 0x07 && buffer[3] === 0x08));
        return isZipSignature;
    } catch (e) {
        return false;
    }
}

// Build frontend locally (saves server resources and time)
async function buildFrontendLocally() {
    console.log('🏗️ Building frontend locally...');
    const frontendDir = path.join(PROJECT_ROOT, 'frontend');
    
    try {
        // Check if node_modules exists
        if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
            console.log('📦 Installing frontend dependencies...');
            execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
        }
        
        // Build
        console.log('📦 Running npm run build...');
        execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
        console.log('✅ Frontend built successfully!');
        return true;
    } catch (e) {
        console.error('❌ Frontend build failed:', e.message);
        return false;
    }
}

// 1. Get Local File Map { relativePath: hash }
async function getLocalFiles() {
    console.log('🔍 Scanning local files...');
    const patterns = [
        'backend/**/*',
        'frontend/dist/**/*',  // Only include built dist
        'frontend/package.json',
        'frontend/vite.config.ts',
        'frontend/tailwind.config.cjs',
        'frontend/postcss.config.js',
        'frontend/tsconfig.json',
        'frontend/index.html',
        'ecosystem.config.js'
    ];
    
    const ignore = [
        '**/node_modules/**',
        '**/.git/**',
        'backend/dist/**',
        '**/.vscode/**',
        '**/*.log',
        '**/.DS_Store',
        '**/deploy.zip',
        '**/deploy_delta.zip',
        '**/*.db',
        '**/*.sqlite',
        '**/*.sqlite3',
        '**/test-results/**',
        '**/test-outputs/**',
        '**/logs/**',
        'backend/uploads/**'
    ];

    const files = {};
    
    for (const pattern of patterns) {
        const matches = await new Promise((resolve, reject) => {
            glob(pattern, { cwd: PROJECT_ROOT, ignore, nodir: true, dot: true }, (err, files) => {
                if (err) reject(err);
                else resolve(files);
            });
        });
        
        for (const f of matches) {
            const fullPath = path.join(PROJECT_ROOT, f);
            const hash = getFileHash(fullPath);
            if (hash) {
                files[normalizePath(f)] = hash;
            }
        }
    }
    return files;
}

// 2. Get Remote File Map { relativePath: hash }
async function getRemoteFiles(conn) {
    console.log('📡 Scanning remote files...');
    return new Promise((resolve, reject) => {
        const cmd = `find eubike/backend eubike/frontend/dist -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -name '*.db' -not -name '*.db-shm' -not -name '*.db-wal' -not -name '*.sqlite' -not -name '*.sqlite3' -exec md5sum {} + 2>/dev/null || true`;
        
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            
            stream.on('close', (code, signal) => {
                const remoteMap = {};
                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const hash = parts[0];
                        let remotePath = parts.slice(1).join(' ');
                        if (remotePath.startsWith('./')) remotePath = remotePath.substring(2);
                        if (remotePath.startsWith('eubike/')) remotePath = remotePath.substring(7);
                        remoteMap[remotePath] = hash;
                    }
                }
                resolve(remoteMap);
            }).on('data', (data) => {
                stdout += data;
            }).stderr.on('data', (data) => {
                stderr += data;
            });
        });
    });
}

// 3. Create Delta Zip with MAX compression (slow upload optimization)
async function createDeltaZip(filesToUpload) {
    if (filesToUpload.length === 0) return null;
    
    console.log(`📦 Creating delta zip with ${filesToUpload.length} files (max compression)...`);
    const zipPath = path.join(PROJECT_ROOT, 'deploy_delta.zip');
    const output = fs.createWriteStream(zipPath);
    // Use level 9 (max compression) for slow upload
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            if (!validateZip(zipPath)) {
                return reject(new Error('Invalid zip archive'));
            }
            const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
            console.log(`✅ Delta zip created: ${sizeMB} MB`);
            console.log(`   Estimated upload time @ 0.5 MB/s: ${Math.ceil(sizeMB / 0.5 * 1.2)} seconds`);
            resolve(zipPath);
        });
        archive.on('error', (err) => reject(err));
        archive.pipe(output);

        for (const file of filesToUpload) {
            archive.file(path.join(PROJECT_ROOT, file), { name: file });
        }
        archive.finalize();
    });
}

async function uploadViaExec(conn, localPath, remotePath) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId = null;
        let stderr = '';
        const finalize = (err) => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (err) reject(err);
            else resolve();
        };

        // Increase timeout for slow upload (10 minutes)
        timeoutId = setTimeout(() => {
            finalize(new Error(`Upload timeout: ${path.basename(localPath)}`));
        }, 600000);

        conn.exec(`cat > ${remotePath}`, (err, stream) => {
            if (err) return finalize(err);
            const readStream = fs.createReadStream(localPath);
            const onError = (e) => {
                readStream.destroy();
                stream.end();
                finalize(e);
            };
            readStream.on('error', onError);
            readStream.on('end', () => {
                stream.end();
            });
            stream.on('error', onError);
            stream.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            stream.on('exit', (code) => {
                if (code === 0) {
                    console.log(`✅ Uploaded ${path.basename(localPath)}`);
                    finalize();
                } else if (typeof code === 'number') {
                    finalize(new Error(`Upload failed: ${path.basename(localPath)}. Code ${code}. ${stderr.trim()}`));
                }
            });
            stream.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Uploaded ${path.basename(localPath)}`);
                    finalize();
                } else {
                    finalize(new Error(`Upload failed: ${path.basename(localPath)}. Code ${code}. ${stderr.trim()}`));
                }
            });
            readStream.pipe(stream);
        });
    });
}

async function uploadFileViaExec(conn, localPath, remotePath) {
    const stats = fs.statSync(localPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`⬆️ Uploading ${path.basename(localPath)} (${sizeMB} MB)...`);
    await uploadViaExec(conn, localPath, remotePath);
}

async function execCommand(conn, cmd, timeout = 300000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Command timeout: ${cmd.substring(0, 50)}...`));
        }, timeout);
        
        console.log(`💻 Executing: ${cmd.substring(0, 80)}...`);
        conn.exec(cmd, (err, stream) => {
            if (err) {
                clearTimeout(timeoutId);
                return reject(err);
            }
            stream.on('close', (code, signal) => {
                clearTimeout(timeoutId);
                console.log(`   Exit code: ${code}`);
                if (code === 0) resolve();
                else reject(new Error(`Command failed with code ${code}`));
            }).on('data', (data) => {
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                process.stderr.write(data);
            });
        });
    });
}

async function run() {
    try {
        console.log('\n' + '═'.repeat(60));
        console.log('🚀 EUBIKE SMART DEPLOY (Optimized for slow upload)');
        console.log('═'.repeat(60) + '\n');
        
        // Step 0: Build frontend locally
        const buildSuccess = await buildFrontendLocally();
        if (!buildSuccess) {
            console.error('❌ Frontend build failed. Aborting deploy.');
            process.exit(1);
        }
        
        const password = await readPassword();
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ SSH Connection established');
            
            try {
                // Cleanup remote temp files
                await execCommand(conn, 'rm -f /root/deploy_delta.zip /root/deploy.zip /root/delete_files.txt');
                
                // 1. Get Local Map
                const localFiles = await getLocalFiles();
                const localKeys = Object.keys(localFiles);
                console.log(`📊 Local files: ${localKeys.length}`);

                // 2. Get Remote Map
                const remoteFiles = await getRemoteFiles(conn);
                const remoteKeys = Object.keys(remoteFiles);
                console.log(`📊 Remote files: ${remoteKeys.length}`);

                // 3. Compute Diff
                const toUpload = [];
                const toDelete = [];
                
                for (const file of localKeys) {
                    if (!remoteFiles[file] || remoteFiles[file] !== localFiles[file]) {
                        toUpload.push(file);
                    }
                }
                
                for (const file of remoteKeys) {
                    if (!localFiles[file]) {
                        toDelete.push(file);
                    }
                }

                console.log(`\n📝 Changes: ${toUpload.length} to upload, ${toDelete.length} to delete`);
                
                if (toUpload.length > 0) {
                    console.log('   Files to upload:');
                    toUpload.slice(0, 10).forEach(f => console.log(`     - ${f}`));
                    if (toUpload.length > 10) console.log(`     ... and ${toUpload.length - 10} more`);
                }

                // 4. Create Delta Zip
                let zipPath = null;
                if (toUpload.length > 0) {
                    zipPath = await createDeltaZip(toUpload);
                }

                // 5. Create Delete List
                if (toDelete.length > 0) {
                    fs.writeFileSync(path.join(PROJECT_ROOT, 'delete_files.txt'), toDelete.join('\n'));
                }

                // 6. Upload
                if (zipPath) {
                    await uploadFileViaExec(conn, zipPath, config.remoteDir + '/deploy_delta.zip');
                    fs.unlinkSync(zipPath);
                } else {
                    console.log('✨ No files to upload - everything is in sync!');
                }

                if (toDelete.length > 0) {
                    await uploadFileViaExec(conn, path.join(PROJECT_ROOT, 'delete_files.txt'), config.deployDir + '/delete_files.txt');
                    fs.unlinkSync(path.join(PROJECT_ROOT, 'delete_files.txt'));
                }

                // Always upload setup script
                await uploadFileViaExec(conn, path.join(PROJECT_ROOT, 'setup-server.sh'), config.remoteDir + '/setup-server.sh');
                
                // 7. Execute Setup (with longer timeout for npm install)
                await execCommand(conn, `chmod +x ${config.remoteDir}/setup-server.sh && ${config.remoteDir}/setup-server.sh`, 600000);
                
                console.log('\n' + '═'.repeat(60));
                console.log('🎉 DEPLOYMENT COMPLETE!');
                console.log('═'.repeat(60) + '\n');
                
                conn.end();

            } catch (e) {
                console.error('❌ Deployment Error:', e);
                process.exitCode = 1;
                conn.end();
            }
        }).on('error', (err) => {
            console.error('❌ SSH Connection Error:', err);
            process.exitCode = 1;
        }).connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: password,
            readyTimeout: 60000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 5
        });

    } catch (e) {
        console.error('❌ Init Error:', e.message);
        process.exit(1);
    }
}

run();
