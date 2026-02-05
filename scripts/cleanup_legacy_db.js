#!/usr/bin/env node
/**
 * Cleanup Script - Remove Old Database Files on Server
 * 
 * This script removes legacy and incorrectly placed database files from the server,
 * leaving only the unified database at /root/eubike/backend/database/eubike.db
 */

const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike'
};

const LEGACY_PATHS = [
    '/root/backend/database/eubike.db',  // Old legacy path
    '/root/eubike/database/eubike.db'    // Incorrect path (missing backend/ in middle)
];

const CORRECT_PATH = '/root/eubike/backend/database/eubike.db';

const ssh = new NodeSSH();

async function main() {
    console.log('🧹 Database Cleanup Script');
    console.log('==========================\n');

    try {
        // Connect to server
        console.log('🔌 Connecting to server...');
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected\n');

        // Check correct database exists
        console.log('🔍 Checking correct database location...');
        const checkCorrect = await ssh.execCommand(`[ -f "${CORRECT_PATH}" ] && echo "exists"`);

        if (checkCorrect.stdout.trim() !== 'exists') {
            console.error('❌ WARNING: Correct database not found at', CORRECT_PATH);
            console.error('   Please upload the database first before running cleanup!');
            process.exit(1);
        }

        const sizeCmd = await ssh.execCommand(`du -h "${CORRECT_PATH}"`);
        console.log(`✅ Correct database found: ${sizeCmd.stdout.split('\t')[0]}\n`);

        // Find and remove legacy databases
        console.log('🔍 Searching for legacy database files...');
        const findResult = await ssh.execCommand('find /root -name "eubike.db" -type f 2>/dev/null');

        if (findResult.stdout) {
            const foundFiles = findResult.stdout.split('\n').filter(Boolean);
            console.log(`Found ${foundFiles.length} database file(s):\n`);

            for (const file of foundFiles) {
                console.log(`  - ${file}`);
            }
            console.log('');

            // Remove legacy files
            let removedCount = 0;
            for (const legacyPath of LEGACY_PATHS) {
                const checkLegacy = await ssh.execCommand(`[ -f "${legacyPath}" ] && echo "exists"`);

                if (checkLegacy.stdout.trim() === 'exists') {
                    console.log(`🗑️  Removing legacy file: ${legacyPath}`);
                    const removeResult = await ssh.execCommand(`rm -f "${legacyPath}"`);

                    if (removeResult.code === 0) {
                        console.log(`   ✅ Removed successfully`);
                        removedCount++;
                    } else {
                        console.error(`   ❌ Failed to remove: ${removeResult.stderr}`);
                    }
                }
            }

            if (removedCount === 0) {
                console.log('✅ No legacy files found to remove\n');
            } else {
                console.log(`\n✅ Removed ${removedCount} legacy database file(s)\n`);
            }
        }

        // Final verification
        console.log('🔍 Final verification - listing all eubike.db files:');
        const finalCheck = await ssh.execCommand('find /root -name "eubike.db*" -type f 2>/dev/null');

        if (finalCheck.stdout) {
            const files = finalCheck.stdout.split('\n').filter(Boolean);
            console.log(`\nFound ${files.length} file(s):\n`);

            for (const file of files) {
                const sizeCmd = await ssh.execCommand(`du -h "${file}"`);
                const size = sizeCmd.stdout.split('\t')[0];
                const isCorrect = file === CORRECT_PATH || file.startsWith(CORRECT_PATH);
                const marker = isCorrect ? '✅' : '⚠️';
                console.log(`  ${marker} ${file} (${size})`);
            }
        }

        console.log('\n✅ Cleanup complete!');

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

main();
