const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    
    // Commands to execute in sequence
    // Using set -e to stop on error
    const cmd = `
        set -e
        echo "=== 1. STOPPING EVERYTHING ==="
        pm2 stop all || true
        pm2 delete all || true
        pm2 save --force
        
        # Kill any stray node processes just in case
        pkill -f node || true
        
        echo "=== 2. CLEANING FRONTEND BUILD ARTIFACTS ==="
        cd /root/eubike/frontend
        rm -rf dist
        rm -rf node_modules/.vite
        rm -rf node_modules/.cache
        
        echo "=== 3. REBUILDING FRONTEND (CLEAN) ==="
        # Ensure deps are installed (should be fast if already there)
        npm install
        
        # Force the ENV var right in the build command
        echo "Building with VITE_API_URL=http://45.9.41.232:8081/api"
        export VITE_API_URL=http://45.9.41.232:8081/api
        npm run build
        
        echo "=== 4. VERIFYING BUILD ==="
        echo "Checking for CORRECT IP..."
        if grep -r "45.9.41.232:8081" dist/assets; then
            echo "✅ SUCCESS: Found Correct IP in build assets."
        else
            echo "❌ FAILURE: Correct IP NOT found!"
            exit 1
        fi
        
        echo "Checking for INCORRECT localhost..."
        if grep -r "localhost:8082" dist/assets; then
            echo "❌ FAILURE: Found localhost:8082 in build assets! Build is tainted."
            # grep -r "localhost:8082" dist/assets # Uncomment to see where
            exit 1
        else
            echo "✅ SUCCESS: No localhost:8082 found in build assets."
        fi
        
        echo "=== 5. RESTARTING SERVICES ==="
        
        echo "Starting Backend..."
        cd /root/eubike/backend
        # Ensure backend .env is correct too
        sed -i 's/PORT=8082/PORT=8081/' .env
        pm2 start API/server.js --name "eubike-backend"
        
        echo "Starting Bot..."
        cd /root/eubike/telegram-bot
        pm2 start bot.js --name "eubike-bot"
        
        echo "Starting Frontend..."
        cd /root/eubike/frontend
        # Use serve explicitly on port 80
        pm2 start "serve -s dist -l 80" --name "eubike-frontend"
        
        echo "=== 6. FINALIZING ==="
        pm2 save
        
        echo "=== DEPLOYMENT COMPLETE & VERIFIED ==="
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect(config);
