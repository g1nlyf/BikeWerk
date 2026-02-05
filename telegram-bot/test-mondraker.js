const { spawn } = require('child_process');
const path = require('path');

// Тестовые данные для объявления Mondraker
const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/mondraker-superfoxy-custom-build-groesse-m-/3179807929-217-8648';
const expectedDescription = `verkaufe hier mein kaum gefahrenes Mondraker suoerfoxy in der Größe m, es ist in einem sehr guten Zustand. 
Kann gerne angeschaut und gegen einen Aufpreis auch versendet werden. 
bei Fragen gerne melden.`;

// Функция для тестирования Groq парсера
async function testGroqParser() {
    console.log('🧪 Тестирование Groq парсера для объявления Mondraker...\n');
    console.log('URL:', testUrl);
    console.log('Ожидаемое описание:', expectedDescription);
    console.log('\n' + '='.repeat(50) + '\n');

    return new Promise((resolve, reject) => {
        // Запускаем Python скрипт с тестовым URL
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'groq-parser.py'),
            testUrl
        ]);

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('❌ Ошибка выполнения Python скрипта:');
                console.error(errorOutput);
                reject(new Error(`Python script exited with code ${code}`));
                return;
            }

            try {
                console.log('📄 Сырой вывод Groq:');
                console.log(output);
                console.log('\n' + '='.repeat(50) + '\n');

                // Пытаемся распарсить JSON
                const result = JSON.parse(output);
                
                console.log('✅ Результат парсинга:');
                console.log(JSON.stringify(result, null, 2));
                
                // Анализируем результаты
                console.log('\n📊 Анализ результатов:');
                console.log('- Название:', result.title || '❌ Отсутствует');
                console.log('- Бренд:', result.brand || '❌ Отсутствует');
                console.log('- Модель:', result.model || '❌ Отсутствует');
                console.log('- Размер рамы:', result.frameSize || '❌ Отсутствует');
                console.log('- Описание:', result.description ? '✅ Найдено' : '❌ Отсутствует');
                console.log('- Тип велосипеда:', result.bikeType || '❌ Отсутствует');
                console.log('- Рейтинг состояния:', result.conditionRating || '❌ Отсутствует');
                console.log('- Продавец:', result.seller ? '✅ Найден' : '❌ Отсутствует');
                console.log('- Доставка:', result.deliveryOption || '❌ Отсутствует');

                // Проверяем размер рамы
                if (result.frameSize) {
                    if (result.frameSize === 'M' || result.frameSize.includes('M')) {
                        console.log('✅ Размер рамы корректный (M)');
                    } else {
                        console.log('❌ Размер рамы некорректный:', result.frameSize, '(ожидался M)');
                    }
                }

                // Проверяем описание
                if (result.description) {
                    const descriptionMatch = result.description.toLowerCase().includes('verkaufe hier mein');
                    if (descriptionMatch) {
                        console.log('✅ Описание найдено корректно');
                    } else {
                        console.log('❌ Описание найдено, но не соответствует ожидаемому');
                        console.log('Найденное описание:', result.description);
                    }
                } else {
                    console.log('❌ Описание не найдено');
                }

                resolve(result);
            } catch (parseError) {
                console.error('❌ Ошибка парсинга JSON:');
                console.error(parseError.message);
                console.log('Сырой вывод:', output);
                reject(parseError);
            }
        });
    });
}

// Запускаем тест
if (require.main === module) {
    testGroqParser()
        .then(() => {
            console.log('\n🎉 Тест завершен');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Тест провален:', error.message);
            process.exit(1);
        });
}

module.exports = { testGroqParser };