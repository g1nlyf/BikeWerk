const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function setupSSL() {
    console.log('🚀 Starting SSL Setup for bikewerk.ru...');

    // 1. Check local files
    const sslDir = path.join(__dirname, '../ssl');
    // Mapped based on user upload
    const crtPath = path.join(sslDir, 'certificate.crt');
    const keyPath = path.join(sslDir, 'certificate.key');
    const bundlePath = path.join(sslDir, 'certificate_ca.crt');

    if (!fs.existsSync(crtPath) || !fs.existsSync(keyPath) || !fs.existsSync(bundlePath)) {
        console.error('❌ Missing SSL files in ssl/ directory!');
        console.error('Expected: certificate.crt, certificate.key, certificate_ca.crt');
        console.error('Found:', fs.readdirSync(sslDir));
        process.exit(1);
    }

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server');

        // 2. Prepare Remote Directory
        const remoteSSLDir = '/etc/ssl/bikewerk.ru';
        await ssh.execCommand(`mkdir -p ${remoteSSLDir}`);

        // 3. Prepare Full Chain (Cert + Bundle)
        console.log('🔗 Generating Full Chain...');
        const crtContent = fs.readFileSync(crtPath, 'utf8');
        const bundleContent = fs.readFileSync(bundlePath, 'utf8');
        // Ensure newline between certs
        const fullChain = crtContent.trim() + '\n' + bundleContent.trim() + '\n';
        
        // Write temporary fullchain locally
        const fullChainPath = path.join(sslDir, 'fullchain.crt');
        fs.writeFileSync(fullChainPath, fullChain);

        // 4. Upload Files
        console.log('📤 Uploading SSL files...');
        await ssh.putFile(fullChainPath, `${remoteSSLDir}/fullchain.crt`);
        await ssh.putFile(keyPath, `${remoteSSLDir}/private.key`);
        
        // Set permissions
        await ssh.execCommand(`chmod 600 ${remoteSSLDir}/private.key`);
        await ssh.execCommand(`chmod 644 ${remoteSSLDir}/fullchain.crt`);

        // 5. Configure Nginx
        console.log('⚙️ Configuring Nginx...');
        
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

    ssl_certificate ${remoteSSLDir}/fullchain.crt;
    ssl_certificate_key ${remoteSSLDir}/private.key;
    
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
        // Write config file locally then upload
        const configPath = path.join(sslDir, 'bikewerk.ru.conf');
        fs.writeFileSync(configPath, nginxConfig);
        await ssh.putFile(configPath, '/etc/nginx/sites-available/bikewerk.ru');

        // 6. Enable Site
        console.log('🔌 Enabling site...');
        await ssh.execCommand('ln -sf /etc/nginx/sites-available/bikewerk.ru /etc/nginx/sites-enabled/bikewerk.ru');
        
        // Check syntax
        const syntaxCheck = await ssh.execCommand('nginx -t');
        if (syntaxCheck.stderr && !syntaxCheck.stderr.includes('syntax is ok')) {
             console.error('❌ Nginx Syntax Error:', syntaxCheck.stderr);
             console.log(syntaxCheck.stdout);
             // process.exit(1); // Don't exit, maybe user can fix
        } else {
             console.log('✅ Nginx Syntax OK');
             // Reload
             await ssh.execCommand('systemctl reload nginx');
             console.log('✅ Nginx Reloaded. HTTPS should be active!');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        ssh.dispose();
        // Cleanup local temp file
        // if (fs.existsSync(path.join(sslDir, 'fullchain.crt'))) fs.unlinkSync(path.join(sslDir, 'fullchain.crt'));
    }
}

setupSSL();
