const DatabaseManager = require('./database/db-manager');
const db = new DatabaseManager().getDatabase();
const schema = db.prepare("SELECT * FROM sqlite_master WHERE type='table' AND name='bikes'").get();
console.log('Schema:', schema);
if (schema) console.log('SQL:', schema.sql);

// Also list all columns via pragma
const cols = db.prepare("PRAGMA table_info(bikes)").all();
console.log('Columns:', cols.map(c => c.name));
