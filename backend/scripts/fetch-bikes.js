const http = require('http');

function fetchJSON(path, port) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    const port = Number(process.argv[2] || 8081);
    const result = await fetchJSON('/api/bikes?limit=12&offset=0', port);
    const bikes = Array.isArray(result?.bikes) ? result.bikes : [];
    console.log(`Port ${port} -> Fetched bikes:`, bikes.length);
    for (const b of bikes) {
      console.log(`#${b.id} name=${b.name} brand=${b.brand} price=${b.price} descLen=${(b.description||'').length}`);
    }
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
})();