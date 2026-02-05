const axios = require('axios');
const cheerio = require('cheerio');

const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/orbea-rallon-only-frame-angebotm-team-rahmengroesse-m-enduro-mtb/2980937338-217-6146';

console.log('🔍 Анализ HTML-структуры для данных продавца');
console.log('📋 URL:', testUrl);
console.log('');

async function analyzeSellerData() {
    try {
        console.log('📥 Загружаем страницу...');
        const response = await axios.get(testUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        console.log('✅ Страница загружена');
        console.log('');
        
        // Поиск различных элементов, которые могут содержать данные о продавце
        console.log('🔍 Поиск элементов с данными о продавце:');
        console.log('');
        
        // 1. Поиск по тексту "Florian"
        console.log('1️⃣ Поиск имени "Florian":');
        $('*').each(function() {
            const text = $(this).text().trim();
            if (text.includes('Florian') && text.length < 100) {
                console.log(`   • Найден элемент: ${$(this).prop('tagName')} - "${text}"`);
                console.log(`     Класс: ${$(this).attr('class') || 'нет'}`);
                console.log(`     ID: ${$(this).attr('id') || 'нет'}`);
                console.log('');
            }
        });
        
        // 2. Поиск по тексту "Privater Nutzer"
        console.log('2️⃣ Поиск типа "Privater Nutzer":');
        $('*').each(function() {
            const text = $(this).text().trim();
            if (text.includes('Privater Nutzer')) {
                console.log(`   • Найден элемент: ${$(this).prop('tagName')} - "${text}"`);
                console.log(`     Класс: ${$(this).attr('class') || 'нет'}`);
                console.log(`     ID: ${$(this).attr('id') || 'нет'}`);
                console.log('');
            }
        });
        
        // 3. Поиск значков
        console.log('3️⃣ Поиск значков (TOP Zufriedenheit, Sehr freundlich, Sehr zuverlässig):');
        const badges = ['TOP Zufriedenheit', 'Sehr freundlich', 'Sehr zuverlässig'];
        badges.forEach(badge => {
            $('*').each(function() {
                const text = $(this).text().trim();
                if (text.includes(badge)) {
                    console.log(`   • Найден значок "${badge}": ${$(this).prop('tagName')}`);
                    console.log(`     Класс: ${$(this).attr('class') || 'нет'}`);
                    console.log(`     ID: ${$(this).attr('id') || 'нет'}`);
                    console.log(`     Текст: "${text}"`);
                    console.log('');
                }
            });
        });
        
        // 4. Поиск даты регистрации
        console.log('4️⃣ Поиск даты "17.03.2014":');
        $('*').each(function() {
            const text = $(this).text().trim();
            if (text.includes('17.03.2014') || text.includes('Aktiv seit')) {
                console.log(`   • Найден элемент: ${$(this).prop('tagName')} - "${text}"`);
                console.log(`     Класс: ${$(this).attr('class') || 'нет'}`);
                console.log(`     ID: ${$(this).attr('id') || 'нет'}`);
                console.log('');
            }
        });
        
        // 5. Поиск общих контейнеров профиля
        console.log('5️⃣ Поиск контейнеров профиля:');
        const profileSelectors = [
            '[class*="profile"]',
            '[class*="seller"]',
            '[class*="user"]',
            '[class*="contact"]',
            '[class*="anbieter"]'
        ];
        
        profileSelectors.forEach(selector => {
            const elements = $(selector);
            if (elements.length > 0) {
                console.log(`   • Найдены элементы по селектору "${selector}": ${elements.length}`);
                elements.each(function(index) {
                    if (index < 3) { // Показываем только первые 3
                        console.log(`     - ${$(this).prop('tagName')}.${$(this).attr('class') || 'no-class'}`);
                        const text = $(this).text().trim();
                        if (text.length < 200) {
                            console.log(`       Текст: "${text}"`);
                        }
                        console.log('');
                    }
                });
            }
        });
        
        // 6. Поиск элементов с data-атрибутами
        console.log('6️⃣ Поиск элементов с data-атрибутами:');
        $('[data-*]').each(function() {
            const attributes = this.attribs;
            const dataAttrs = Object.keys(attributes).filter(attr => attr.startsWith('data-'));
            if (dataAttrs.length > 0) {
                const text = $(this).text().trim();
                if (text.includes('Florian') || text.includes('Privater') || text.includes('TOP') || text.includes('17.03')) {
                    console.log(`   • Элемент с data-атрибутами: ${$(this).prop('tagName')}`);
                    dataAttrs.forEach(attr => {
                        console.log(`     ${attr}: ${attributes[attr]}`);
                    });
                    console.log(`     Текст: "${text}"`);
                    console.log('');
                }
            }
        });
        
    } catch (error) {
        console.log('❌ Ошибка:', error.message);
    }
}

analyzeSellerData();