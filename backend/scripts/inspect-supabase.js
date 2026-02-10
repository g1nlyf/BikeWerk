// Deprecated: this script previously tried to "probe" enum values by inserting invalid rows,
// which is a DB mutation and should not be used in normal workflows.
//
// Use the safe SQL Editor export flow instead:
// - `node scripts/supabase_schema_dump.js`
// - Run the "enums (bonus)" query in Supabase SQL Editor
// - Save results to `docs/supabase_schema_enums.json`
//
// This file intentionally does not load any secrets or perform network/DB operations.

console.log('inspect-supabase.js is deprecated.');
console.log('Use: node scripts/supabase_schema_dump.js (from repo root).');