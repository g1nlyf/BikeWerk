const { spawn } = require('child_process');
const path = require('path');

// URL для тестирования
const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/orbea-rallon-only-frame-angebotm-team-rahmengroesse-m-enduro-mtb/2980937338-217-6146';

// Ожидаемые данные продавца (из скриншота)
const expectedSeller = {
    name: 'Florian',
    type: 'Privater Nutzer',
    badges: ['TOP Zufriedenheit', 'Sehr freundlich', 'Sehr zuverlässig'],
    memberSince: '17.03.2014',
    rating: null // На скриншоте не видно рейтинга
};

console.log('🧪 Тестирование извлечения данных продавца для Orbea Rallon');
console.log('📋 URL:', testUrl);
console.log('📋 Ожидаемые данные продавца:');
console.log('   • Имя:', expectedSeller.name);
console.log('   • Тип:', expectedSeller.type);
console.log('   • Значки:', expectedSeller.badges.join(', '));
console.log('   • Активен с:', expectedSeller.memberSince);
console.log('');

// Запуск Python скрипта
const pythonScript = path.join(__dirname, 'groq-parser.py');
const pythonProcess = spawn('python', [pythonScript, testUrl], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
});

pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
});

pythonProcess.on('close', (code) => {
    console.log('🔍 Результаты тестирования:');
    console.log('');
    
    if (code !== 0) {
        console.log('❌ Python скрипт завершился с ошибкой:', code);
        if (errorOutput) {
            console.log('Ошибка:', errorOutput);
        }
        return;
    }

    try {
        const result = JSON.parse(output);
        
        console.log('✅ JSON успешно распарсен');
        console.log('');
        
        // Анализ основных полей
        console.log('📊 Основные поля:');
        console.log('- Заголовок:', result.title || '❌ Отсутствует');
        console.log('- Бренд:', result.brand || '❌ Отсутствует');
        console.log('- Модель:', result.model || '❌ Отсутствует');
        console.log('- Цена:', result.price || '❌ Отсутствует');
        console.log('- Размер рамы:', result.frameSize || '❌ Отсутствует');
        console.log('');
        
        // Анализ данных продавца
        console.log('👤 Анализ данных продавца:');
        if (result.seller) {
            console.log('✅ Поле seller найдено');
            console.log('   • Имя:', result.seller.name || '❌ Отсутствует');
            console.log('   • Тип:', result.seller.type || '❌ Отсутствует');
            console.log('   • Значки:', result.seller.badges ? result.seller.badges.join(', ') : '❌ Отсутствуют');
            console.log('   • Активен с:', result.seller.memberSince || '❌ Отсутствует');
            console.log('   • Рейтинг:', result.seller.rating || '❌ Отсутствует');
            
            // Сравнение с ожидаемыми данными
            console.log('');
            console.log('🔍 Сравнение с ожидаемыми данными:');
            console.log('   • Имя:', result.seller.name === expectedSeller.name ? '✅ Совпадает' : `❌ Ожидалось: ${expectedSeller.name}`);
            console.log('   • Тип:', result.seller.type === expectedSeller.type ? '✅ Совпадает' : `❌ Ожидалось: ${expectedSeller.type}`);
            
            // Проверка значков
            const foundBadges = result.seller.badges || [];
            const missingBadges = expectedSeller.badges.filter(badge => !foundBadges.includes(badge));
            const extraBadges = foundBadges.filter(badge => !expectedSeller.badges.includes(badge));
            
            if (missingBadges.length === 0 && extraBadges.length === 0) {
                console.log('   • Значки: ✅ Все совпадают');
            } else {
                console.log('   • Значки: ❌ Не совпадают');
                if (missingBadges.length > 0) {
                    console.log('     - Отсутствуют:', missingBadges.join(', '));
                }
                if (extraBadges.length > 0) {
                    console.log('     - Лишние:', extraBadges.join(', '));
                }
            }
            
            console.log('   • Дата регистрации:', result.seller.memberSince === expectedSeller.memberSince ? '✅ Совпадает' : `❌ Ожидалось: ${expectedSeller.memberSince}`);
            
        } else {
            console.log('❌ Поле seller отсутствует');
        }
        
        console.log('');
        console.log('📄 Полный JSON ответ:');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.log('❌ Ошибка парсинга JSON:', error.message);
        console.log('📄 Сырой вывод:');
        console.log(output);
        if (errorOutput) {
            console.log('📄 Ошибки:');
            console.log(errorOutput);
        }
    }
});

pythonProcess.on('error', (error) => {
    console.log('❌ Ошибка запуска Python скрипта:', error.message);
});