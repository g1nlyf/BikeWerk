/**
 * Deploy SEO files (robots.txt, sitemap.xml) to server
 */

const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: fs.readFileSync(path.join(__dirname, '../deploy_password.txt'), 'utf8').trim()
};

const ssh = new NodeSSH();

async function deploySEO() {
    console.log('🚀 Deploying SEO files (robots.txt, sitemap.xml)...\n');

    try {
        await ssh.connect(config);
        console.log('✅ Connected to server\n');

        // 1. Build frontend to ensure files are in dist/
        console.log('📦 Building frontend...');
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
            exec('cd frontend && npm run build', (error, stdout, stderr) => {
                if (error) {
                    console.error('Build error:', error);
                    reject(error);
                    return;
                }
                console.log(stdout);
                resolve();
            });
        });
        console.log('✅ Frontend built\n');

        // 2. Upload robots.txt
        const robotsPath = path.join(__dirname, '../frontend/dist/robots.txt');
        if (fs.existsSync(robotsPath)) {
            console.log('📤 Uploading robots.txt...');
            await ssh.putFile(robotsPath, '/var/www/html/robots.txt');
            console.log('✅ robots.txt uploaded\n');
        } else {
            console.log('⚠️ robots.txt not found in dist/, uploading from public/...');
            const robotsPublicPath = path.join(__dirname, '../frontend/public/robots.txt');
            if (fs.existsSync(robotsPublicPath)) {
                await ssh.putFile(robotsPublicPath, '/var/www/html/robots.txt');
                console.log('✅ robots.txt uploaded from public/\n');
            } else {
                console.log('❌ robots.txt not found!\n');
            }
        }

        // 3. Upload sitemap.xml
        const sitemapPath = path.join(__dirname, '../frontend/dist/sitemap.xml');
        if (fs.existsSync(sitemapPath)) {
            console.log('📤 Uploading sitemap.xml...');
            await ssh.putFile(sitemapPath, '/var/www/html/sitemap.xml');
            console.log('✅ sitemap.xml uploaded\n');
        } else {
            console.log('⚠️ sitemap.xml not found in dist/, uploading from public/...');
            const sitemapPublicPath = path.join(__dirname, '../frontend/public/sitemap.xml');
            if (fs.existsSync(sitemapPublicPath)) {
                await ssh.putFile(sitemapPublicPath, '/var/www/html/sitemap.xml');
                console.log('✅ sitemap.xml uploaded from public/\n');
            } else {
                console.log('❌ sitemap.xml not found!\n');
            }
        }

        // 4. Update nginx config to serve robots.txt and sitemap.xml directly
        console.log('⚙️ Updating nginx config...');
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

    # Serve robots.txt and sitemap.xml directly
    location = /robots.txt {
        access_log off;
        log_not_found off;
        try_files $uri =404;
    }

    location = /sitemap.xml {
        access_log off;
        log_not_found off;
        try_files $uri =404;
    }

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

        await ssh.execCommand(`cat > /etc/nginx/sites-available/bikewerk.ru << 'EOF'
${nginxConfig}
EOF`);

        // 5. Test nginx config
        console.log('🧪 Testing nginx config...');
        const testResult = await ssh.execCommand('nginx -t');
        if (testResult.code !== 0) {
            console.error('❌ Nginx config test failed:', testResult.stderr);
            process.exit(1);
        }
        console.log('✅ Nginx config is valid\n');

        // 6. Reload nginx
        console.log('🔄 Reloading nginx...');
        await ssh.execCommand('systemctl reload nginx');
        console.log('✅ Nginx reloaded\n');

        // 7. Verify files
        console.log('🔍 Verifying files on server...');
        const robotsCheck = await ssh.execCommand('test -f /var/www/html/robots.txt && echo "EXISTS" || echo "MISSING"');
        const sitemapCheck = await ssh.execCommand('test -f /var/www/html/sitemap.xml && echo "EXISTS" || echo "MISSING"');
        
        console.log(`   robots.txt: ${robotsCheck.stdout.trim()}`);
        console.log(`   sitemap.xml: ${sitemapCheck.stdout.trim()}\n`);

        // 8. Test URLs
        console.log('🌐 Testing URLs...');
        const robotsTest = await ssh.execCommand('curl -sI https://bikewerk.ru/robots.txt | head -1');
        const sitemapTest = await ssh.execCommand('curl -sI https://bikewerk.ru/sitemap.xml | head -1');
        
        console.log(`   robots.txt: ${robotsTest.stdout.trim()}`);
        console.log(`   sitemap.xml: ${sitemapTest.stdout.trim()}\n`);

        console.log('✅ SEO files deployed successfully!');
        console.log('\n📋 Next steps:');
        console.log('   1. Check https://bikewerk.ru/robots.txt in browser');
        console.log('   2. Check https://bikewerk.ru/sitemap.xml in browser');
        console.log('   3. Submit sitemap in Google Search Console');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

if (require.main === module) {
    deploySEO();
}

module.exports = { deploySEO };
