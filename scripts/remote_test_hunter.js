const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const ssh = new NodeSSH();
const PROJECT_ROOT = path.resolve(__dirname, '../');
const PASS_FILE = path.join(PROJECT_ROOT, 'deploy_password.txt');

async function readPassword() {
    if (!fs.existsSync(PASS_FILE)) {
        throw new Error(`Password file not found: ${PASS_FILE}`);
    }
    const pass = fs.readFileSync(PASS_FILE, 'utf8').trim();
    return pass;
}

(async () => {
    try {
        const password = await readPassword();
        console.log('🔑 Connecting to server...');
        
        await ssh.connect({
            host: '45.9.41.232',
            username: 'root',
            password: password
        });
        
        console.log('✅ Connected. Uploading UnifiedHunter patch...');
        
        // Upload the patched UnifiedHunter
        const localHunterPath = path.join(PROJECT_ROOT, 'telegram-bot/unified-hunter.js');
        const remoteHunterPath = '/root/eubike/telegram-bot/unified-hunter.js';
        
        await ssh.putFile(localHunterPath, remoteHunterPath);
        console.log('✅ UnifiedHunter.js uploaded.');

        console.log('✅ Running Hunter Test...');
        
        // 0. Test Proxy & URL
        console.log('🌐 Testing Proxy Connectivity & URL...');
        
        // Test 1: Homepage
        console.log('Testing Homepage...');
        await ssh.execCommand('curl -x http://user258350:otuspk@191.101.73.161:8984 -I https://www.kleinanzeigen.de --connect-timeout 10', { cwd: '/root/eubike' }).then(r => console.log(r.stdout));

        // Test 2: Search URL Variations
        const variations = [
            { name: 'User Provided 1 (Shipping Yes)', url: 'https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/c217+fahrraeder.versand_s:ja' },
            { name: 'User Provided 2 (Base)', url: 'https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/c217' },
            { name: 'User Provided 3 (MTB)', url: 'https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/c217+fahrraeder.type_s:mountainbike' },
            { name: 'User Provided 4 (Brand Canyon)', url: 'https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/canyon/k0c217' }
        ];

        for (const v of variations) {
            console.log(`Testing ${v.name}: ${v.url}`);
            // Use debug_page_<index>.html to avoid overwriting
            const filename = `/root/eubike/debug_page_${variations.indexOf(v)}.html`;
            
            const searchCheck = await ssh.execCommand(`curl -x http://user258350:otuspk@191.101.73.161:8984 -L -v "${v.url}" -o ${filename} --connect-timeout 15`, {
                cwd: '/root/eubike'
            });
            console.log(`${v.name} Curl Status:`, searchCheck.stderr.includes('200 OK') ? '200 OK' : 'Check Logs');
            
            // Check for items
            const grepCheck = await ssh.execCommand(`grep -o "aditem" ${filename} | wc -l`, { cwd: '/root/eubike' });
            console.log(`${v.name} Items Found:`, grepCheck.stdout.trim());
            
            // Check title
            const titleCheck = await ssh.execCommand(`grep -o "<title>.*</title>" ${filename}`, { cwd: '/root/eubike' });
            console.log(`${v.name} Title:`, titleCheck.stdout.trim());

            await new Promise(r => setTimeout(r, 2000)); // Delay to be nice
        }

        // 1. Run the trigger script
        // Inject GEMINI_API_KEY explicitly to ensure it's available
        const result = await ssh.execCommand('export GEMINI_API_KEY=AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0; node backend/scripts/trigger_hunter.js', {
            cwd: '/root/eubike'
        });
        
        console.log('--- STDOUT ---');
        console.log(result.stdout);
        console.log('--- STDERR ---');
        console.log(result.stderr);
        
        if (result.code !== 0) {
            console.error('❌ Hunter Test Failed');
        } else {
            console.log('✅ Hunter Test Completed');
            
            // 2. Check DB population via Node (safer)
            console.log('📊 Verifying Database Population...');
            const dbCheck = await ssh.execCommand('node -e "const DB = require(\'./telegram-bot/bikes-database-node\'); const db = new DB(); db.getQuery(\'SELECT COUNT(*) as c FROM bikes\').then(r=>console.log(\'Total Bikes:\', r.c)).catch(e=>console.error(e))"', {
                cwd: '/root/eubike'
            });
            console.log(dbCheck.stdout);
            console.log(dbCheck.stderr);
        }

        ssh.dispose();
        
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
})();
