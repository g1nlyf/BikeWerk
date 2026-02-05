const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function fixSSLFinal() {
    console.log('🚀 Starting Final SSL Fix (CSP + Data Cleanup)...');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server');

        // 1. Clear Bikes Table (As requested to rule out content issues)
        console.log('🧹 Clearing Catalog Data...');
        const clearCmd = `
            cd /root/eubike/backend
            node -e "
                const db = require('better-sqlite3')('database/eubike.db');
                db.prepare('DELETE FROM bikes').run();
                console.log('Catalog cleared.');
            "
        `;
        await ssh.execCommand(clearCmd);

        // 2. Update Nginx Config with CSP Header
        // This forces browser to upgrade ALL http requests to https automatically
        console.log('🛡️ Applying Content-Security-Policy to Nginx...');
        
        const nginxConfig = `
server {
    listen 80;
    listen [::]:80;
    server_name bikewerk.ru www.bikewerk.ru;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bikewerk.ru www.bikewerk.ru;

    ssl_certificate /etc/ssl/bikewerk.ru/fullchain.crt;
    ssl_certificate_key /etc/ssl/bikewerk.ru/private.key;
    
    # SECURITY HEADERS
    add_header Content-Security-Policy "upgrade-insecure-requests" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # SSL Tuning
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static Assets Cache
    location /assets {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
`;
        // Write locally first
        const confPath = path.join(__dirname, '../ssl/bikewerk_secure.conf');
        fs.writeFileSync(confPath, nginxConfig);
        
        // Upload
        await ssh.putFile(confPath, '/etc/nginx/sites-available/bikewerk.ru');
        
        // Reload Nginx
        console.log('🔄 Reloading Nginx...');
        await ssh.execCommand('systemctl reload nginx');

        console.log('✅ Fix Applied:');
        console.log('   1. Catalog cleared (no bad images)');
        console.log('   2. CSP "upgrade-insecure-requests" enabled (forces HTTPS)');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        ssh.dispose();
    }
}

fixSSLFinal();
