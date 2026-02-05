const fs = require('fs').promises;
const path = require('path');

async function fixExistingBikes() {
    try {
        console.log('🔧 Исправляю существующие велосипеды в базе данных...');
        
        const dbPath = path.join(__dirname, 'bikes-data.json');
        const dbContent = await fs.readFile(dbPath, 'utf8');
        const bikes = JSON.parse(dbContent);
        
        let updatedCount = 0;
        
        // Обновляем велосипеды, добавленные через бота
        bikes.forEach(bike => {
            if (bike.source === 'kleinanzeigen' || bike.source === 'telegram-bot') {
                // Если у велосипеда нет поля images, создаем его
                if (!bike.images) {
                    // Если у велосипеда есть локальное изображение, ищем все связанные изображения
                    if (bike.image && bike.image.includes('src/images/bikes/')) {
                        // Извлекаем ID велосипеда из пути изображения
                        const imageMatch = bike.image.match(/bike_(\d+)_\d+\.webp/);
                        if (imageMatch) {
                            const bikeImageId = imageMatch[1];
                            // Создаем массив изображений (предполагаем до 5 изображений)
                            const images = [];
                            for (let i = 1; i <= 5; i++) {
                                const imagePath = `src/images/bikes/bike_${bikeImageId}_${i}.webp`;
                                images.push(imagePath);
                            }
                            bike.images = images;
                            updatedCount++;
                            console.log(`✅ Обновлен велосипед: ${bike.name} (ID: ${bike.id}) - добавлено ${images.length} изображений`);
                        }
                    } else {
                        // Если изображение внешнее, создаем массив с одним изображением
                        bike.images = [bike.image];
                        updatedCount++;
                        console.log(`✅ Обновлен велосипед: ${bike.name} (ID: ${bike.id}) - добавлено 1 изображение`);
                    }
                }
            }
        });
        
        // Сохраняем обновленную базу данных
        await fs.writeFile(dbPath, JSON.stringify(bikes, null, 2), 'utf8');
        
        console.log(`🎉 Обновление завершено! Обновлено велосипедов: ${updatedCount}`);
        
    } catch (error) {
        console.error('❌ Ошибка при обновлении базы данных:', error);
    }
}

// Запускаем скрипт
fixExistingBikes();