/* eslint-disable no-console */
const path = require('path');

process.env.DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../database/eubike.db');

const { DatabaseManager } = require('../src/js/mysql-config');
const { generateDemoMetricsDataset } = require('../src/services/metrics/demoDataGenerator');

function readArg(name, fallback) {
    const prefix = `--${name}=`;
    const hit = process.argv.find((arg) => String(arg).startsWith(prefix));
    if (!hit) return fallback;
    return hit.slice(prefix.length);
}

async function run() {
    const sessions = Number(readArg('sessions', '1000'));
    const daysBack = Number(readArg('daysBack', '35'));
    const seed = Number(readArg('seed', String(Date.now())));

    const db = new DatabaseManager();
    try {
        await db.initialize();
        const result = await generateDemoMetricsDataset(db, {
            sessionCount: sessions,
            daysBack,
            seed
        });
        console.log(JSON.stringify(result, null, 2));
    } finally {
        try { await db.close(); } catch { /* ignore */ }
    }
}

run().catch((error) => {
    console.error('Demo dataset generation failed:', error?.message || error);
    process.exit(1);
});
