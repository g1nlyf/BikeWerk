const { NodeSSH } = require('node-ssh');

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

const ssh = new NodeSSH();

const nginxConfig = `
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    # Self-signed certs (if available) or snakeoil to support HTTPS requests to IP
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    root /var/www/html;
    index index.html;

    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8081/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;

async function main() {
    console.log('Configuring Server...');
    await ssh.connect(config);

    try {
        // 1. Stop redundant PM2 frontend process
        console.log('Stopping PM2 frontend...');
        await ssh.execCommand('pm2 stop eubike-frontend');
        await ssh.execCommand('pm2 delete eubike-frontend');
        await ssh.execCommand('pm2 save');

        // 2. Prepare /var/www/html
        console.log('Updating /var/www/html...');
        // Backup
        await ssh.execCommand('mv /var/www/html /var/www/html_old_' + Date.now());
        await ssh.execCommand('mkdir -p /var/www/html');
        
        // Copy files from deployment dir
        await ssh.execCommand('cp -r /root/eubike/frontend/dist/* /var/www/html/');
        
        // Fix permissions
        await ssh.execCommand('chown -R www-data:www-data /var/www/html');
        await ssh.execCommand('chmod -R 755 /var/www/html');

        // 3. Update Nginx Config
        console.log('Updating Nginx config...');
        // Check if snakeoil exists, if not generate it
        const checkCert = await ssh.execCommand('[ -f /etc/ssl/certs/ssl-cert-snakeoil.pem ] && echo "exists"');
        if (checkCert.stdout.trim() !== 'exists') {
            console.log('Generating self-signed cert...');
            await ssh.execCommand('openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/ssl-cert-snakeoil.key -out /etc/ssl/certs/ssl-cert-snakeoil.pem -subj "/C=US/ST=Dev/L=Dev/O=Dev/CN=45.9.41.232"');
        }

        // Write config
        const tempConfigPath = '/tmp/eubike.nginx';
        await ssh.execCommand(`echo '${nginxConfig}' > ${tempConfigPath}`);
        await ssh.execCommand(`mv ${tempConfigPath} /etc/nginx/sites-available/default`); // Overwrite default
        
        // Ensure link exists
        await ssh.execCommand('ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default');

        // 4. Reload Nginx
        console.log('Reloading Nginx...');
        const test = await ssh.execCommand('nginx -t');
        if (test.stderr.includes('successful')) {
            await ssh.execCommand('systemctl reload nginx');
            console.log('Nginx reloaded successfully.');
        } else {
            console.error('Nginx config test failed:', test.stderr);
        }

    } catch (e) {
        console.error('Error:', e);
    }

    ssh.dispose();
}

main();
