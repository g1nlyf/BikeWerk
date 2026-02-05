const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/eubike.db');
const db = new Database(dbPath, { readonly: true });

console.log('🔍 FINAL VERIFICATION REPORT (KPI Check)\n');

const metrics = [
    {
        name: 'Total Records',
        query: "SELECT COUNT(*) as val FROM market_history",
        target: 3000,
        op: '>='
    },
    {
        name: 'Year Coverage %',
        query: "SELECT ROUND(COUNT(CASE WHEN year IS NOT NULL THEN 1 END)*100.0/COUNT(*), 1) as val FROM market_history",
        target: 80,
        op: '>'
    },
    {
        name: 'Category Coverage %',
        query: "SELECT ROUND(COUNT(CASE WHEN category IS NOT NULL AND category != '' THEN 1 END)*100.0/COUNT(*), 1) as val FROM market_history",
        target: 95,
        op: '>'
    },
    {
        name: 'Avg Quality Score',
        query: "SELECT ROUND(AVG(quality_score), 1) as val FROM market_history",
        target: 75,
        op: '>'
    },
    {
        name: 'Trim Level Coverage %',
        query: "SELECT ROUND(COUNT(CASE WHEN trim_level IS NOT NULL THEN 1 END)*100.0/COUNT(*), 1) as val FROM market_history",
        target: 40,
        op: '>'
    }
];

console.log('┌───────────────────────┬──────────┬──────────┬────────┐');
console.log('│ Metric                │ Value    │ Target   │ Status │');
console.log('├───────────────────────┼──────────┼──────────┼────────┤');

metrics.forEach(m => {
    try {
        const row = db.prepare(m.query).get();
        const val = row.val;
        let passed = false;
        if (m.op === '>=') passed = val >= m.target;
        if (m.op === '>') passed = val > m.target;
        
        const status = passed ? '✅' : '❌';
        console.log(`│ ${m.name.padEnd(21)} │ ${String(val).padEnd(8)} │ ${m.op}${m.target}`.padEnd(42) + ` │   ${status}   │`);
    } catch (e) {
        console.error(`Error calculating ${m.name}: ${e.message}`);
    }
});

console.log('└───────────────────────┴──────────┴──────────┴────────┘');
