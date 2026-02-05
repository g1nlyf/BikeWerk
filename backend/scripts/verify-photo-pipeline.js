const fs = require('fs');
const path = require('path');
const PhotoManager = require('../src/services/PhotoManager.js');

function parseArgs(argv) {
    const out = { bikeId: 999999, url: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=1200' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--bike-id') out.bikeId = Number(argv[++i] || 0) || out.bikeId;
        if (a === '--url') out.url = String(argv[++i] || '').trim() || out.url;
    }
    return out;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const photoManager = new PhotoManager();
    console.log(`🧪 Проверка фото-пайплайна для bike_id=${args.bikeId}`);
    const results = await photoManager.downloadAndSave(args.bikeId, [args.url]);
    const ok = results.some(r => r.is_downloaded && r.local_path);
    const dirPath = path.resolve(__dirname, '../public/images/bikes', `id${args.bikeId}`);

    if (ok) {
        console.log('✅ Загрузка и оптимизация успешны');
    } else {
        console.log('❌ Загрузка не удалась');
    }

    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }

    if (!ok) process.exit(1);
}

main().catch((e) => {
    console.error('❌ Ошибка verify-photo-pipeline.js:', e?.message || e);
    process.exit(1);
});
