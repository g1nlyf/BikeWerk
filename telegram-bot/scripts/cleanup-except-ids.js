// Cleanup script: remove all bike photos and DB records except specified IDs
// Preserves records and images for bikes with IDs in PRESERVE_IDS

const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3').verbose();

// Adjust IDs to preserve here
const PRESERVE_IDS = [1001, 1002];

// Resolve paths consistent with telegram-bot modules
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, '..', 'backend', 'database', 'eubike.db');
const imageDir = path.resolve(projectRoot, '..', 'backend', 'public', 'images', 'bikes');

function log(msg) {
  console.log(msg);
}

async function getPreservedImagePaths(db) {
  return new Promise((resolve, reject) => {
    const placeholders = PRESERVE_IDS.map(() => '?').join(',');
    const sql = `SELECT bike_id, image_url FROM bike_images WHERE bike_id IN (${placeholders})`;
    db.all(sql, PRESERVE_IDS, (err, rows) => {
      if (err) return reject(err);
      // Convert web paths like /images/bikes/id1001/1.webp to filesystem paths
      const preserved = new Set();
      for (const row of rows) {
        if (!row.image_url) continue;
        const clean = row.image_url.replace(/^\/images\/bikes\//, '');
        const fsPath = path.join(imageDir, clean);
        preserved.add(path.resolve(fsPath));
      }
      resolve(preserved);
    });
  });
}

async function cleanupImages(preservedPaths) {
  log(`🖼️ Очистка изображений в директории: ${imageDir}`);
  try {
    await fs.access(imageDir).catch(async () => {
      log(`📁 Директория изображений отсутствует, создаю: ${imageDir}`);
      await fs.mkdir(imageDir, { recursive: true });
    });

    const entries = await fs.readdir(imageDir, { withFileTypes: true });
    let deletedFiles = 0;
    let deletedDirs = 0;

    for (const entry of entries) {
      const entryPath = path.join(imageDir, entry.name);
      if (entry.isDirectory()) {
        // Directory name format: id<bikeId>
        const match = entry.name.match(/^id(\d+)$/);
        const bikeId = match ? parseInt(match[1], 10) : null;
        if (bikeId && PRESERVE_IDS.includes(bikeId)) {
          // Skip entire directory
          continue;
        }
        // Remove entire directory recursively
        await fs.rm(entryPath, { recursive: true, force: true });
        deletedDirs++;
        log(`🗑️ Удалена директория: ${entry.name}`);
      } else {
        // Root-level file under images/bikes — delete if not preserved
        const resolved = path.resolve(entryPath);
        if (!preservedPaths.has(resolved)) {
          await fs.rm(entryPath, { force: true });
          deletedFiles++;
          log(`🗑️ Удален файл: ${entry.name}`);
        }
      }
    }

    log(`✅ Очистка изображений завершена: удалено директорий=${deletedDirs}, удалено файлов=${deletedFiles}`);
    return { deletedDirs, deletedFiles };
  } catch (err) {
    log(`❌ Ошибка при очистке изображений: ${err.message}`);
    throw err;
  }
}

async function cleanupDatabase(db) {
  log(`🗃️ Очистка записей в базе данных (кроме ID: ${PRESERVE_IDS.join(', ')})`);
  const placeholders = PRESERVE_IDS.map(() => '?').join(',');
  const queries = [
    { sql: `DELETE FROM bike_images WHERE bike_id NOT IN (${placeholders})`, params: PRESERVE_IDS },
    { sql: `DELETE FROM bike_specs WHERE bike_id NOT IN (${placeholders})`, params: PRESERVE_IDS },
    { sql: `DELETE FROM bikes WHERE id NOT IN (${placeholders})`, params: PRESERVE_IDS },
  ];

  for (const q of queries) {
    await new Promise((resolve, reject) => {
      db.run(q.sql, q.params, function (err) {
        if (err) return reject(err);
        log(`✔️ Выполнено: ${q.sql.split('(')[0].trim()} (изменено: ${this.changes})`);
        resolve();
      });
    });
  }
}

async function main() {
  log('🚀 Запуск скрипта очистки (кроме указанных ID)');
  log(`📁 Путь к БД: ${dbPath}`);
  log(`🖼️ Каталог изображений: ${imageDir}`);

  const db = new sqlite3.Database(dbPath);

  try {
    // Gather preserved image paths from DB
    const preservedPaths = await getPreservedImagePaths(db);
    log(`🔒 Всего защищенных изображений: ${preservedPaths.size}`);

    // Filesystem cleanup
    await cleanupImages(preservedPaths);

    // Database cleanup
    await cleanupDatabase(db);

    log('✅ Очистка завершена успешно.');
  } catch (err) {
    log(`❌ Ошибка очистки: ${err.message}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
