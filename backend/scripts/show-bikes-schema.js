const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
console.log(`Connecting to DB at: ${dbPath}`);

try {
    const db = new Database(dbPath, { readonly: true });
    
    // Get columns for 'bikes' table
    const columns = db.prepare("PRAGMA table_info(bikes)").all();
    
    console.log('\n=== BIKES TABLE SCHEMA ===');
    console.log(`Total Columns: ${columns.length}\n`);
    
    // Print header
    console.log(
        'CID'.padEnd(5) + 
        'NAME'.padEnd(30) + 
        'TYPE'.padEnd(15) + 
        'NOTNULL'.padEnd(10) + 
        'DEFAULT'.padEnd(20) + 
        'PK'
    );
    console.log('-'.repeat(90));

    // Print rows
    columns.forEach(col => {
        console.log(
            String(col.cid).padEnd(5) + 
            col.name.padEnd(30) + 
            col.type.padEnd(15) + 
            String(col.notnull).padEnd(10) + 
            String(col.dflt_value).padEnd(20) + 
            String(col.pk)
        );
    });

    console.log('\n=== END OF SCHEMA ===');

} catch (err) {
    console.error('Error:', err.message);
}
