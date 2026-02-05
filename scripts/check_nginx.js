const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
  host: '45.9.41.232',
  username: 'root',
  password: '&9&%4q6631vI',
  readyTimeout: 20000
};

async function checkNginx() {
  try {
    console.log('Connecting to server...');
    await ssh.connect(config);
    console.log('Connected.');

    // 1. Check Nginx Config
    console.log('\n--- Checking Nginx Configuration ---');
    const nginxConfig = await ssh.execCommand('cat /etc/nginx/sites-enabled/default'); // Assuming default
    if (nginxConfig.stdout) {
        console.log('Nginx Config (stdout):');
        console.log(nginxConfig.stdout);
    } else {
        console.log('Could not read /etc/nginx/sites-enabled/default. Trying /etc/nginx/nginx.conf or listing sites-enabled.');
        const lsSites = await ssh.execCommand('ls -l /etc/nginx/sites-enabled/');
        console.log('Sites enabled:', lsSites.stdout);
        
        // Try to grep proxy_pass in /etc/nginx recursively
        const grepProxy = await ssh.execCommand('grep -r "proxy_pass" /etc/nginx/');
        console.log('Grep proxy_pass:', grepProxy.stdout);
    }

    // 2. Check Nginx Error Log for details on 502
    console.log('\n--- Checking Nginx Error Log (Last 20 lines) ---');
    const errorLog = await ssh.execCommand('tail -n 20 /var/log/nginx/error.log');
    console.log(errorLog.stdout);

    ssh.dispose();

  } catch (error) {
    console.error('Diagnosis failed:', error);
    if (ssh.isConnected()) ssh.dispose();
  }
}

checkNginx();
