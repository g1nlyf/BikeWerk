const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

/**
 * Groq Integration Module
 * Модуль для интеграции с Groq API через Python парсер
 */
class GroqIntegration {
    constructor() {
        this.pythonScript = path.join(__dirname, 'groq-parser.py');
        this.apiKey = process.env.GROQ_API_KEY;
        
        if (!this.apiKey) {
            this.apiKey = '';
        }
    }

    /**
     * Парсинг URL с помощью Groq
     * @param {string} url - URL объявления Kleinanzeigen
     * @returns {Promise<Object>} - Результат парсинга
     */
    async parseUrl(url) {
        return new Promise((resolve, reject) => {
            console.log(`🤖 Запуск Groq парсера для URL: ${url}`);
            
            // Запускаем Python скрипт
            const pythonProcess = spawn('py', [
                this.pythonScript,
                url,
                '--api-key',
                this.apiKey
            ], {
                cwd: __dirname,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            // Собираем данные из stdout
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            // Собираем ошибки из stderr
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Обработка завершения процесса
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        // Парсим JSON результат
                        const result = JSON.parse(stdout.trim());
                        console.log(`✅ Groq парсинг завершен успешно`);
                        resolve(result);
                    } catch (parseError) {
                        console.error('❌ Ошибка парсинга JSON:', parseError.message);
                        console.error('Stdout:', stdout);
                        reject(new Error(`Ошибка парсинга JSON: ${parseError.message}`));
                    }
                } else {
                    console.error(`❌ Python процесс завершился с кодом: ${code}`);
                    console.error('Stderr:', stderr);
                    reject(new Error(`Python процесс завершился с ошибкой (код ${code}): ${stderr}`));
                }
            });

            // Обработка ошибок запуска процесса
            pythonProcess.on('error', (error) => {
                console.error('❌ Ошибка запуска Python процесса:', error.message);
                reject(new Error(`Ошибка запуска Python: ${error.message}`));
            });

            // Таймаут для длительных операций
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Таймаут: парсинг занял слишком много времени'));
            }, 60000); // 60 секунд

            pythonProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Форматирование результата для отправки в Telegram
     * @param {Object} data - Данные велосипеда
     * @returns {string} - Отформатированное сообщение
     */
    formatBikeData(data) {
        if (!data.success) {
            return `❌ Ошибка парсинга: ${data.error || 'Неизвестная ошибка'}`;
        }

        const {
            title,
            brand,
            model,
            price,
            condition,
            conditionRating,
            frameSize,
            category,
            bikeType,
            location,
            description,
            isNegotiable,
            deliveryOption,
            seller,
            url
        } = data;

        let message = `🚴‍♂️ *${title || 'Велосипед'}*\n\n`;

        // Основная информация для фильтров
        if (brand) message += `🏷️ *Бренд:* ${brand}\n`;
        if (model) message += `📝 *Модель:* ${model}\n`;
        if (category) message += `🚲 *Категория:* ${category}\n`;
        if (bikeType) message += `🎯 *Тип:* ${bikeType}\n`;
        
        if (price) {
            message += `💰 *Цена:* ${price}€`;
            if (isNegotiable) message += ` (торг возможен)`;
            message += `\n`;
        }
        
        // Состояние с рейтингом
        if (condition) {
            message += `⭐ *Состояние:* ${condition}`;
            if (conditionRating) {
                const stars = '⭐'.repeat(Math.min(Math.max(Math.round(conditionRating), 1), 5));
                message += ` (${conditionRating}/10 ${stars})`;
            }
            message += `\n`;
        }
        
        // Размер рамы - важно для фильтров
        if (frameSize) message += `📏 *Размер рамы:* ${frameSize} см\n`;
        
        // Продавец с детальной информацией
        if (seller) {
            message += `\n👤 *Продавец:*\n`;
            if (seller.name) message += `   • Имя: ${seller.name}\n`;
            if (seller.type) message += `   • Тип: ${seller.type}\n`;
            if (seller.badges && seller.badges.length > 0) {
                message += `   • Статусы: ${seller.badges.join(', ')}\n`;
            }
            if (seller.memberSince) message += `   • Активен с: ${seller.memberSince}\n`;
            if (seller.rating) message += `   • Рейтинг: ${seller.rating}\n`;
        }
        
        // Местоположение
        if (location) message += `\n📍 *Местоположение:* ${location}\n`;
        
        // Доставка
        if (deliveryOption) message += `🚚 *Доставка:* ${deliveryOption}\n`;
        
        // Описание
        if (description && description.length > 0) {
            message += `\n📄 *Описание:*\n${description.substring(0, 300)}${description.length > 300 ? '...' : ''}\n`;
        }
        
        message += `\n🔗 [Посмотреть объявление](${url})`;
        message += `\n\n🤖 *Обработано с помощью Groq AI*`;

        return message;
    }

    /**
     * Проверка доступности Groq API
     * @returns {Promise<boolean>} - true если API доступен
     */
    async checkApiAvailability() {
        try {
            // Тестируем с простым URL
            const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/test/123456';
            const result = await this.parseUrl(testUrl);
            return true;
        } catch (error) {
            console.error('Groq API недоступен:', error.message);
            return false;
        }
    }
}

module.exports = GroqIntegration;