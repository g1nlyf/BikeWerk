const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

function resolveDbPath() {
    const preferred = path.resolve(__dirname, '../backend/database/eubike.db');
    const legacy = path.resolve(__dirname, '../backend/database/eubike.db');
    return fs.existsSync(preferred) ? preferred : legacy;
}

function normalizeRecord(category, discipline) {
    const d = String(discipline || '').toLowerCase();
    const c = String(category || '').toLowerCase();

    if (d.includes('kids') || d.includes('Ð´ÐµÑ‚ÑÐº') || d.includes('child') || d.includes('junior') || d.includes('kinder') || d.includes('14"') || d.includes('16"') || d.includes('20"') || d.includes('24"')) {
        let sub = 'Kids Balance';
        if (d.includes('14"')) sub = 'Kids 14"';
        else if (d.includes('16"')) sub = 'Kids 16"';
        else if (d.includes('20"')) sub = 'Kids 20"';
        else if (d.includes('24"')) sub = 'Kids 24"';
        return { category: 'kids', sub };
    }

    if (d.includes('e-mtb') || d.includes('emtb') || d.includes('e mtb')) {
        return { category: 'emtb', sub: 'eMTB eMTB' };
    }

    if (d.includes('gravel') || d.includes('bikepacking') || d.includes('allroad') || d.includes('all-road') || d.includes('cyclocross') || d.includes('cx')) {
        if (d.includes('race')) return { category: 'gravel', sub: 'GRAVEL Race' };
        if (d.includes('bikepacking')) return { category: 'gravel', sub: 'GRAVEL Bikepacking' };
        return { category: 'gravel', sub: 'GRAVEL Allroad' };
    }

    if (d.includes('road') || d.includes('rennrad') || d.includes('aero') || d.includes('endurance') || d.includes('climbing') || d.includes('tt') || d.includes('triathlon')) {
        if (d.includes('aero')) return { category: 'road', sub: 'ROAD Aero' };
        if (d.includes('endurance')) return { category: 'road', sub: 'ROAD Endurance' };
        if (d.includes('climbing')) return { category: 'road', sub: 'ROAD Climbing' };
        if (d.includes('tt') || d.includes('triathlon')) return { category: 'road', sub: 'ROAD TT' };
        return { category: 'road', sub: 'ROAD Endurance' };
    }

    if (d.includes('mtb') || d.includes('mountain') || d.includes('enduro') || d.includes('downhill') || d.includes('trail') || d.includes('xc')) {
        if (d.includes('downhill') || d.includes('dh')) return { category: 'mtb', sub: 'MTB DH' };
        if (d.includes('enduro')) return { category: 'mtb', sub: 'MTB Enduro' };
        if (d.includes('trail')) return { category: 'mtb', sub: 'MTB Trail' };
        if (d.includes('xc')) return { category: 'mtb', sub: 'MTB XC' };
        return { category: 'mtb', sub: 'MTB Trail' };
    }

    if (c.includes('Ð³Ñ€Ð°Ð²')) return { category: 'gravel', sub: null };
    if (c.includes('ÑˆÐ¾ÑÑ')) return { category: 'road', sub: null };
    if (c.includes('ÑÐ»ÐµÐºÑ‚Ñ€Ð¾')) return { category: 'emtb', sub: null };
    if (c.includes('Ð´ÐµÑ‚')) return { category: 'kids', sub: null };
    if (c.includes('Ð³Ð¾Ñ€Ð½')) return { category: 'mtb', sub: null };

    return { category: 'mtb', sub: null };
}

async function run() {
    const dbPath = resolveDbPath();
    const db = new sqlite3.Database(dbPath);
    const all = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    const cols = await all("PRAGMA table_info('bikes')");
    const hasDiscipline = cols.some(c => c.name === 'discipline');
    const hasSource = cols.some(c => c.name === 'source');
    const hasAddedAt = cols.some(c => c.name === 'added_at');
    const hasCreatedAt = cols.some(c => c.name === 'created_at');
    const orderCol = hasAddedAt ? 'added_at' : hasCreatedAt ? 'created_at' : 'id';
    const where = [];
    if (hasSource) where.push("source = 'AutoHunter'");
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const selectCols = ['id', 'category'];
    if (hasDiscipline) selectCols.push('discipline');
    const rows = await all(`SELECT ${selectCols.join(', ')} FROM bikes ${whereSql} ORDER BY ${orderCol} DESC LIMIT 100`);
    const total = rows.length;

    const categoryCounts = { mtb: 0, gravel: 0, road: 0, emtb: 0, kids: 0 };
    const subCounts = {
        'MTB Enduro': 0,
        'MTB DH': 0,
        'MTB Trail': 0,
        'MTB XC': 0,
        'GRAVEL Allroad': 0,
        'GRAVEL Race': 0,
        'GRAVEL Bikepacking': 0,
        'ROAD Aero': 0,
        'ROAD Endurance': 0,
        'ROAD Climbing': 0,
        'ROAD TT': 0,
        'eMTB eMTB': 0,
        'Kids Balance': 0,
        'Kids 14"': 0,
        'Kids 16"': 0,
        'Kids 20"': 0,
        'Kids 24"': 0
    };

    for (const row of rows) {
        const info = normalizeRecord(row.category, row.discipline);
        if (categoryCounts[info.category] !== undefined) {
            categoryCounts[info.category] += 1;
        }
        if (info.sub && subCounts[info.sub] !== undefined) {
            subCounts[info.sub] += 1;
        }
    }

    const targets = { mtb: 45, gravel: 25, road: 20, emtb: 8, kids: 2 };

    console.log('DB Path:', dbPath);
    console.log('Total bikes analyzed:', total);
    console.log('\nCategory Distribution:');
    for (const key of Object.keys(categoryCounts)) {
        const count = categoryCounts[key];
        const pct = total ? ((count / total) * 100).toFixed(1) : '0.0';
        const target = targets[key] || 0;
        const delta = total ? (count - Math.round((target / 100) * total)) : 0;
        console.log(`- ${key}: ${count} (${pct}%) target ${target}% delta ${delta}`);
    }

    console.log('\nSubcategory Distribution:');
    Object.entries(subCounts).forEach(([key, count]) => {
        if (count > 0) {
            const pct = total ? ((count / total) * 100).toFixed(1) : '0.0';
            console.log(`- ${key}: ${count} (${pct}%)`);
        }
    });

    await new Promise(resolve => db.close(resolve));
}

run().catch(err => {
    console.error('Verification failed:', err.message);
    process.exit(1);
});

