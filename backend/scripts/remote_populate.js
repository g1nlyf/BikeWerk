const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const DUMP_FILE = 'full_json_dump_10.json';
const LOCAL_DUMP_PATH = path.resolve(__dirname, `../tests/debug/${DUMP_FILE}`);
const REMOTE_DUMP_DIR = '/root/eubike/backend/data';
const REMOTE_DUMP_PATH = `${REMOTE_DUMP_DIR}/${DUMP_FILE}`;

const POPULATE_SCRIPT = 'populate_from_dump.js';
const LOCAL_SCRIPT_PATH = path.resolve(__dirname, POPULATE_SCRIPT);
const REMOTE_SCRIPT_PATH = `/root/eubike/backend/scripts/${POPULATE_SCRIPT}`;

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

console.log('⚡ Starting Remote Population Protocol...');

conn.on('ready', () => {
    console.log('✅ SSH Connection established.');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        // 1. Create remote data directory if not exists
        conn.exec(`mkdir -p ${REMOTE_DUMP_DIR}`, (err, stream) => {
            if (err) throw err;
            stream.on('close', () => {
                
                // 2. Upload JSON Dump
                console.log(`📤 Uploading ${DUMP_FILE}...`);
                sftp.fastPut(LOCAL_DUMP_PATH, REMOTE_DUMP_PATH, (err) => {
                    if (err) throw err;
                    console.log('✅ Dump uploaded.');
                    
                    // 3. Upload Populate Script
                    console.log(`📤 Uploading ${POPULATE_SCRIPT}...`);
                    sftp.fastPut(LOCAL_SCRIPT_PATH, REMOTE_SCRIPT_PATH, (err) => {
                        if (err) throw err;
                        console.log('✅ Script uploaded.');
                        
                        // 4. Run Population Script Remotely
                        console.log('🚀 Running population script on server...');
                        // Note: path in script assumes relative to __dirname, so we run it from scripts dir or adjust
                        // The script uses: path.join(__dirname, '../tests/debug/full_json_dump_10.json')
                        // We need to ensure the remote path matches or create a temp wrapper.
                        // Let's create a quick wrapper on the fly or just move the dump to where the script expects it.
                        
                        const fixCmd = `
                            mkdir -p /root/eubike/backend/tests/debug
                            cp ${REMOTE_DUMP_PATH} /root/eubike/backend/tests/debug/${DUMP_FILE}
                            cd /root/eubike/backend
                            node scripts/${POPULATE_SCRIPT}
                        `;
                        
                        conn.exec(fixCmd, (err, stream) => {
                            if (err) throw err;
                            stream.on('close', (code) => {
                                console.log('🎁 Population Finished with code ' + code);
                                conn.end();
                            }).on('data', (data) => {
                                process.stdout.write(data);
                            }).stderr.on('data', (data) => {
                                process.stderr.write(data);
                            });
                        });
                    });
                });
            });
        });
    });
}).connect(config);
