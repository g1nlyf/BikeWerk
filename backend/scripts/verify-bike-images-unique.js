const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function main() {
    console.log('🧪 Проверка уникальности bike_images');
    console.log(`📦 БД: ${dbPath}`);

    const duplicates = await all(
        `
        SELECT bike_id, image_url, COUNT(*) as c
        FROM bike_images
        GROUP BY bike_id, image_url
        HAVING c > 1
        LIMIT 5
        `
    );

    const indexes = await all(`PRAGMA index_list('bike_images')`);
    const uniqueIndex = indexes.find((idx) => idx.name === 'idx_bike_images_unique' && idx.unique === 1);

    if (duplicates.length > 0) {
        console.log('❌ Найдены дубликаты изображений:');
        console.table(duplicates);
    } else {
        console.log('✅ Дубликаты не найдены');
    }

    if (uniqueIndex) {
        console.log('✅ Уникальный индекс idx_bike_images_unique найден');
    } else {
        console.log('❌ Уникальный индекс idx_bike_images_unique отсутствует');
    }

    if (duplicates.length > 0 || !uniqueIndex) {
        process.exit(1);
    }

    process.exit(0);
}

main()
    .catch((e) => {
        console.error('❌ Ошибка проверки:', e.message);
        process.exit(1);
    })
    .finally(() => db.close());
