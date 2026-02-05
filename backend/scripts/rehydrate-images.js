const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../telegram-bot/.env') });

process.env.DB_PATH = path.resolve(__dirname, '../database/eubike.db');
process.env.BOT_DB_PATH = process.env.DB_PATH;

const BikesDatabase = require('../../telegram-bot/bikes-database-node.js');
const KleinanzeigenParser = require('../../telegram-bot/kleinanzeigen-parser.js');
const ImageHandler = require('../../telegram-bot/image-handler.js');

const PUBLIC_ROOT = path.resolve(__dirname, '../public');

function parseArgs(argv) {
    const out = { limit: 50, ids: null, dryRun: false, maxImages: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--limit') out.limit = Number(argv[++i] || 0) || 0;
        else if (a === '--ids') out.ids = String(argv[++i] || '').split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
        else if (a === '--dry-run') out.dryRun = true;
        else if (a === '--max-images') out.maxImages = Number(argv[++i] || 0) || 0;
    }
    return out;
}

function normalizeImagePath(u) {
    if (!u) return '';
    const s = String(u).trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    return s.startsWith('/') ? s : `/${s}`;
}

function localImageExists(u) {
    const rel = normalizeImagePath(u);
    if (!rel) return false;
    if (!rel.startsWith('/images/')) return true;
    const filePath = path.join(PUBLIC_ROOT, rel.replace(/^\/images\//, 'images/'));
    try { return fs.existsSync(filePath); } catch { return false; }
}

function hasAnyLocalImages(bikeId) {
    try {
        const dirPath = path.join(PUBLIC_ROOT, 'images', 'bikes', `id${bikeId}`);
        if (!fs.existsSync(dirPath)) return false;
        const files = fs.readdirSync(dirPath).filter((f) => /(\.png|\.jpg|\.jpeg|\.webp|\.gif)$/i.test(f));
        return files.length > 0;
    } catch {
        return false;
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const bikesDB = new BikesDatabase();
    const parser = new KleinanzeigenParser();
    if (args.maxImages && args.maxImages > 0) {
        process.env.IMAGE_MAX_COUNT = String(args.maxImages);
    }
    const imageHandler = new ImageHandler();

    await bikesDB.ensureInitialized();

    let bikes = [];
    if (args.ids && args.ids.length > 0) {
        const placeholders = args.ids.map(() => '?').join(',');
        bikes = await bikesDB.allQuery(
            `SELECT id, original_url, main_image FROM bikes WHERE id IN (${placeholders}) ORDER BY id DESC`,
            args.ids
        );
    } else {
        const limit = args.limit > 0 ? args.limit : 50;
        bikes = await bikesDB.allQuery(
            'SELECT id, original_url, main_image FROM bikes WHERE is_active = 1 ORDER BY id DESC LIMIT ?',
            [limit]
        );
    }

    console.log(`🧬 Восстановление изображений: кандидатов ${bikes.length}. dryRun=${args.dryRun ? 'ДА' : 'НЕТ'}`);

    let processed = 0;
    let fixed = 0;
    let skipped = 0;
    let failed = 0;

    for (const bike of bikes) {
        processed++;
        const bikeId = bike.id;
        const url = bike.original_url;
        const mainImage = bike.main_image;

        const alreadyOk = localImageExists(mainImage) || hasAnyLocalImages(bikeId);
        if (alreadyOk) {
            skipped++;
            console.log(`⏭️ ID ${bikeId}: изображения уже на месте`);
            continue;
        }

        if (!url || !String(url).trim()) {
            failed++;
            console.log(`❌ ID ${bikeId}: нет original_url, пропускаю`);
            continue;
        }

        console.log(`🔄 ID ${bikeId}: парсю объявление и перекачиваю изображения`);

        try {
            const parsed = await parser.parseKleinanzeigenLink(url);
            const images = Array.isArray(parsed?.images) ? parsed.images.filter(Boolean) : [];

            if (images.length === 0) {
                failed++;
                console.log(`❌ ID ${bikeId}: парсер не дал images`);
                continue;
            }

            if (args.dryRun) {
                console.log(`🧪 ID ${bikeId}: dry-run, нашел ${images.length} URL изображений`);
                continue;
            }

            await imageHandler.deleteImagesForBike(bikeId);
            await bikesDB.runQuery('DELETE FROM bike_images WHERE bike_id = ?', [bikeId]);

            const localPaths = await imageHandler.downloadAndProcessImages(images, bikeId);
            if (localPaths.length === 0) {
                failed++;
                console.log(`❌ ID ${bikeId}: загрузка/сохранение изображений не удалась`);
                continue;
            }

            await bikesDB.addBikeImages(bikeId, localPaths);
            await bikesDB.updateBike(bikeId, { main_image: localPaths[0] });

            fixed++;
            console.log(`✅ ID ${bikeId}: восстановлено ${localPaths.length} изображений`);
        } catch (e) {
            failed++;
            console.log(`❌ ID ${bikeId}: ошибка восстановления: ${e?.message || e}`);
        }
    }

    console.log(`🏁 Готово. processed=${processed} fixed=${fixed} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => {
    console.error('❌ Критическая ошибка rehydrate-images.js:', e?.message || e);
    process.exit(1);
});
