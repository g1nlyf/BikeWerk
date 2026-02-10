const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function repoPath(p) {
  return path.resolve(__dirname, '..', '..', '..', p);
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    throw new Error('Usage: node backend/tests/live/hunter-one-bike-full-pipeline.js <listing_url>');
  }

  require('dotenv').config({ path: repoPath('backend/.env') });
  require('dotenv').config({ path: repoPath('telegram-bot/.env') });

  // Canonical DB for full end-to-end check
  process.env.DB_PATH = repoPath('backend/database/eubike.db');

  const DeepPipelineProcessor = require('../../src/services/DeepPipelineProcessor');
  const ok = await DeepPipelineProcessor.processListing(url);

  if (!ok) {
    throw new Error('DeepPipelineProcessor.processListing returned false');
  }

  const adIdMatch = String(url).match(/\/(\d+)-\d+-\d+\/?$/);
  const sourceAdId = adIdMatch ? adIdMatch[1] : null;

  const db = new Database(process.env.DB_PATH, { readonly: true });
  const row = sourceAdId
    ? db
        .prepare(
          `SELECT * FROM bikes
           WHERE source_ad_id = ?
              OR source_url = ?
              OR original_url = ?
           ORDER BY id DESC LIMIT 1`
        )
        .get(sourceAdId, url, url)
    : db
        .prepare(
          `SELECT * FROM bikes
           WHERE source_url = ?
              OR original_url = ?
           ORDER BY id DESC LIMIT 1`
        )
        .get(url, url);
  db.close();

  if (!row) {
    throw new Error('Bike row not found after pipeline run');
  }

  const outPath = repoPath('docs/hunter-one-bike-latest.json');
  fs.writeFileSync(outPath, JSON.stringify(row, null, 2), 'utf8');

  console.log(`[hunter-one-bike] OK: ${ok}`);
  console.log(`[hunter-one-bike] bike_id=${row.id}`);
  console.log(`[hunter-one-bike] output=${outPath}`);
}

main().catch((err) => {
  console.error('[hunter-one-bike] FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
