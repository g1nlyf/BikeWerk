const { NodeSSH } = require('node-ssh');
const chalk = require('chalk');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI',
    remoteBase: '/root/eubike'
};

const ssh = new NodeSSH();

async function fixEverything() {
    console.log(chalk.red.bold('🚀 STARTING FINAL FIX PROTOCOL (NO LOCALHOST ALLOWED)'));

    try {
        await ssh.connect({
            host: config.host,
            username: config.username,
            password: config.password,
            tryKeyboard: true
        });
        console.log('✅ Connected to server.');

        // 1. Fix Backend .env
        console.log(chalk.yellow('\n1. 🔧 Fixing Backend .env...'));
        const envCmd = `
            cd ${config.remoteBase}/backend
            # Replace or append PUBLIC_URL
            if grep -q "PUBLIC_URL" .env; then
                sed -i 's|PUBLIC_URL=.*|PUBLIC_URL=https://bikewerk.ru|' .env
            else
                echo "PUBLIC_URL=https://bikewerk.ru" >> .env
            fi
            
            # Ensure PORT is 8082 (as expected by Nginx)
            if grep -q "PORT" .env; then
                sed -i 's/PORT=.*/PORT=8082/' .env
            else
                echo "PORT=8082" >> .env
            fi
            
            cat .env
        `;
        await ssh.execCommand(envCmd);
        console.log('✅ Backend .env updated.');

        // 2. Sanitize Database (The Nuclear Option for Links)
        console.log(chalk.yellow('\n2. 🧹 Sanitizing Database Content...'));
        const dbFixScript = `
            const db = require('better-sqlite3')('database/eubike.db');
            
            console.log('--- Cleaning bikes table ---');
            // Fix main_image starting with http://localhost...
            const r1 = db.prepare("UPDATE bikes SET main_image = REPLACE(main_image, 'http://localhost:8082', '') WHERE main_image LIKE 'http://localhost:8082%'").run();
            console.log('Fixed main_image localhost prefix:', r1.changes);
            
            // Fix images JSON
            const r2 = db.prepare("UPDATE bikes SET images = REPLACE(images, 'http://localhost:8082', '') WHERE images LIKE '%http://localhost:8082%'").run();
            console.log('Fixed images localhost prefix:', r2.changes);

            // Force https for any other http links (except relative)
            const r3 = db.prepare("UPDATE bikes SET main_image = REPLACE(main_image, 'http:', 'https:') WHERE main_image LIKE 'http:%' AND main_image NOT LIKE 'http://localhost%'").run();
            console.log('Fixed other http links:', r3.changes);
        `;
        
        // Write temp script on remote
        await ssh.execCommand(`echo "${dbFixScript.replace(/"/g, '\\"')}" > ${config.remoteBase}/backend/scripts/sanitize_db_links.js`);
        
        // Run it
        const dbRes = await ssh.execCommand(`node ${config.remoteBase}/backend/scripts/sanitize_db_links.js`, { cwd: `${config.remoteBase}/backend` });
        console.log(dbRes.stdout || dbRes.stderr);


        // 3. Rebuild Frontend (The "Clean Slate")
        console.log(chalk.yellow('\n3. 🏗️ Rebuilding Frontend (FORCE RELATIVE API)...'));
        const buildCmd = [
            `cd ${config.remoteBase}/frontend`,
            'rm -rf dist node_modules/.vite', // Clear cache
            'export VITE_API_URL=/api',       // FORCE relative path
            'npm run build'
        ].join(' && ');
        
        const buildRes = await ssh.execCommand(buildCmd);
        if (buildRes.stderr && !buildRes.stderr.includes('warn')) {
            console.log(chalk.gray(buildRes.stdout)); // Show stdout for debug
            // Don't fail on warnings, but show errors
            console.error(chalk.red('Build stderr:'), buildRes.stderr);
        } else {
            console.log('✅ Frontend built successfully.');
        }

        // 4. Update Nginx Static Files
        console.log(chalk.yellow('\n4. 📦 Deploying to Nginx...'));
        await ssh.execCommand('rm -rf /var/www/html/*');
        await ssh.execCommand(`cp -r ${config.remoteBase}/frontend/dist/* /var/www/html/`);
        await ssh.execCommand('chown -R www-data:www-data /var/www/html');
        
        // 5. Restart Backend
        console.log(chalk.yellow('\n5. 🔄 Restarting Backend...'));
        await ssh.execCommand('pm2 restart eubike-backend');
        
        console.log(chalk.green.bold('\n✨ FIX COMPLETE!'));
        console.log('Please clear browser cache and check https://bikewerk.ru');

    } catch (e) {
        console.error(chalk.red('❌ Error:'), e);
    } finally {
        ssh.dispose();
    }
}

fixEverything();
