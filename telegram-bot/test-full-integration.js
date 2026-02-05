// Тест полной интеграции: Groq парсинг + создание карточки каталога
const GroqIntegration = require('./groq-integration');
const GroqToCatalogAdapter = require('./groq-to-catalog-adapter');
const BikesDatabase = require('./bikes-database-node');
const path = require('path');

async function testFullIntegration() {
    console.log('🧪 Тестирование полной интеграции Groq + Каталог\n');
    
    try {
        // 1. Инициализация компонентов
        console.log('1️⃣ Инициализация компонентов...');
        const groqIntegration = new GroqIntegration();
        const groqAdapter = new GroqToCatalogAdapter();
        const bikesDatabase = new BikesDatabase();
        
        // Загружаем базу данных
        await bikesDatabase.loadBikes();
        console.log(`✅ База данных загружена: ${bikesDatabase.bikes.length} велосипедов\n`);
        
        // 2. Тестовая ссылка
        const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/trek-fuel-ex-8-29-2022-gr-l-mountainbike-fully-enduro/2948863088-217-4306';
        console.log(`2️⃣ Тестовая ссылка: ${testUrl}\n`);
        
        // 3. Парсинг с Groq
        console.log('3️⃣ Парсинг данных с Groq...');
        const groqResult = await groqIntegration.parseUrl(testUrl);
        
        if (!groqResult.success) {
            throw new Error(`Groq парсинг не удался: ${groqResult.error}`);
        }
        
        console.log('✅ Groq данные получены:');
        console.log(JSON.stringify(groqResult, null, 2));
        console.log();
        
        // 4. Адаптация данных
        console.log('4️⃣ Адаптация данных для каталога...');
        const catalogData = groqAdapter.adaptGroqDataToCatalog(groqResult);
        
        console.log('✅ Данные адаптированы:');
        console.log(JSON.stringify(catalogData, null, 2));
        console.log();
        
        // 5. Валидация
        console.log('5️⃣ Валидация данных...');
        const validation = groqAdapter.validateCatalogData(catalogData);
        
        if (validation.isValid) {
            console.log('✅ Данные валидны');
        } else {
            console.log('⚠️ Предупреждения валидации:');
            validation.errors.forEach(error => console.log(`  - ${error}`));
        }
        console.log();
        
        // 6. Добавление placeholder изображения
        console.log('6️⃣ Добавление placeholder изображения...');
        catalogData.images = ['src/images/bikes/placeholder.jpg'];
        console.log('✅ Placeholder изображение добавлено\n');
        
        // 7. Добавление в базу данных
        console.log('7️⃣ Добавление в базу данных каталога...');
        const addedBike = bikesDatabase.addBike(catalogData);
        
        console.log('✅ Велосипед добавлен в каталог:');
        console.log(`  - ID: ${addedBike.id}`);
        console.log(`  - Название: ${addedBike.name}`);
        console.log(`  - Цена: ${addedBike.price}€`);
        console.log(`  - Категория: ${addedBike.category}`);
        console.log(`  - Бренд: ${addedBike.brand}`);
        console.log(`  - Местоположение: ${addedBike.location}`);
        console.log(`  - Продавец: ${addedBike.seller?.name} (${addedBike.seller?.type})`);
        console.log(`  - Значки: ${addedBike.seller?.badges?.join(', ') || 'Нет'}`);
        console.log();
        
        // 8. Сохранение базы данных
        console.log('8️⃣ Сохранение базы данных...');
        await bikesDatabase.saveBikes();
        console.log('✅ База данных сохранена\n');
        
        // 9. Итоговая статистика
        console.log('📊 Итоговая статистика:');
        console.log(`  - Всего велосипедов в каталоге: ${bikesDatabase.bikes.length}`);
        console.log(`  - Последний добавленный ID: ${addedBike.id}`);
        console.log(`  - Источник: ${addedBike.source}`);
        console.log(`  - Оригинальная ссылка: ${addedBike.originalUrl}`);
        
        console.log('\n🎉 Полная интеграция успешно протестирована!');
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error.message);
        console.error('Стек ошибки:', error.stack);
    }
}

// Запуск теста
testFullIntegration();