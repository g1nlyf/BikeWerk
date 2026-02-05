const fs = require('fs');
const path = require('path');
const { db } = require('../src/js/mysql-config');

async function verify() {
    const imagesDir = path.resolve(__dirname, '../../public/images/bikes');
    if (!fs.existsSync(imagesDir)) {
        throw new Error('Каталог изображений не найден');
    }

    const bikeFolders = fs.readdirSync(imagesDir).filter(name => name.startsWith('id'));
    if (bikeFolders.length !== 10) {
        throw new Error(`Ожидается 10 папок байков, найдено ${bikeFolders.length}`);
    }

    for (const folder of bikeFolders) {
        const fullPath = path.join(imagesDir, folder);
        const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.webp'));
        if (files.length <= 1) {
            throw new Error(`В папке ${folder} недостаточно фото: ${files.length}`);
        }
    }

    const bikes = await db.query('SELECT COUNT(*) as count FROM bikes');
    const bikeImages = await db.query('SELECT COUNT(*) as count FROM bike_images');
    const bikesCount = bikes[0]?.count || 0;
    const imagesCount = bikeImages[0]?.count || 0;
    if (bikesCount !== 10) {
        throw new Error(`Ожидается 10 байков в БД, найдено ${bikesCount}`);
    }
    if (imagesCount < 20) {
        throw new Error(`Ожидается минимум 20 фото в БД, найдено ${imagesCount}`);
    }

    const dumpPath = path.resolve(__dirname, '../tests/debug/full_json_dump_10.json');
    if (!fs.existsSync(dumpPath)) {
        throw new Error('Файл full_json_dump_10.json не найден');
    }
    const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
    const dumpCount = Array.isArray(dump) ? dump.length : Object.keys(dump).length;
    if (dumpCount !== 10) {
        throw new Error(`Ожидается 10 записей в дампе, найдено ${dumpCount}`);
    }

    console.log('✅ Верификация успешна: 10 байков, фото и дамп соответствуют требованиям');
}

verify().catch(err => {
    console.error(`❌ Ошибка верификации: ${err.message}`);
    process.exit(1);
});
