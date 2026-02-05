const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('--- YT Capra 2022 ---');
const row = db.prepare("SELECT count(*) as total, count(distinct source_url) as unique_urls FROM market_history WHERE brand='YT' AND model='Capra' AND year=2022").get();
console.log(JSON.stringify(row, null, 2));

const duplicates = db.prepare("SELECT source_url, count(*) as c FROM market_history WHERE brand='YT' AND model='Capra' AND year=2022 GROUP BY source_url HAVING c > 1 LIMIT 5").all();
console.log('Duplicates sample:', JSON.stringify(duplicates, null, 2));

console.log('--- YT Capra 2021 ---');
const row21 = db.prepare("SELECT count(*) as total, count(distinct source_url) as unique_urls FROM market_history WHERE brand='YT' AND model='Capra' AND year=2021").get();
console.log(JSON.stringify(row21, null, 2));
