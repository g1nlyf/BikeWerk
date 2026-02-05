const http = require('http');

http.get('http://localhost:8082/api/market/raw-data', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Data:', data.substring(0, 500)); // Print first 500 chars
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
