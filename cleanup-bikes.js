const BikesDatabase = require('./telegram-bot/bikes-database-node');
const ImageHandler = require('./telegram-bot/image-handler');

async function cleanup() {
    const db = new BikesDatabase();
    const imageHandler = new ImageHandler();

    try {
        const rows = await db.allQuery('SELECT id FROM bikes WHERE id > ?', [122]);
        const ids = rows.map(r => r.id);
        if (!ids.length) {
            console.log('Нет велосипедов с id > 122');
            return;
        }

        console.log(`Удаляются велосипеды: ${ids.join(', ')}`);

        for (const id of ids) {
            try { await imageHandler.deleteImagesForBike(id); } catch (_) {}
            try { await db.runQuery('DELETE FROM bike_images WHERE bike_id = ?', [id]); } catch (_) {}
            try { await db.runQuery('DELETE FROM bike_specs WHERE bike_id = ?', [id]); } catch (_) {}
            try { await db.runQuery('DELETE FROM user_favorites WHERE bike_id = ?', [id]); } catch (_) {}
            try { await db.runQuery('DELETE FROM shopping_cart WHERE bike_id = ?', [id]); } catch (_) {}
            try { await db.runQuery('DELETE FROM order_items WHERE bike_id = ?', [id]); } catch (_) {}
            await db.runQuery('DELETE FROM bikes WHERE id = ?', [id]);
            console.log(`Удален велосипед id=${id}`);
        }

        try { await db.runQuery('VACUUM'); } catch (_) {}
        console.log('Очистка завершена');
    } catch (error) {
        console.error('Ошибка очистки:', error);
        process.exit(1);
    }
}

cleanup();
