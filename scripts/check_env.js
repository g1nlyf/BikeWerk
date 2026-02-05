const { exec } = require('child_process');

console.log('--- Environment Variables ---');
console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY);
console.log('HTTP_PROXY:', process.env.HTTP_PROXY);
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Unset');
console.log('NODE_ENV:', process.env.NODE_ENV);

console.log('\n--- Network Ports ---');
exec('netstat -tuln', (err, stdout) => {
    if (err) console.log('netstat failed');
    else console.log(stdout);
});
