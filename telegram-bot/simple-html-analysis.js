const axios = require('axios');
const fs = require('fs');

const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/orbea-rallon-only-frame-angebotm-team-rahmengroesse-m-enduro-mtb/2980937338-217-6146';

console.log('Загружаем HTML страницы...');

axios.get(testUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
}).then(response => {
    console.log('Страница загружена, сохраняем HTML...');
    
    // Сохраняем HTML в файл
    fs.writeFileSync('orbea-page.html', response.data);
    
    // Ищем ключевые фрагменты
    const html = response.data;
    
    console.log('Анализируем HTML...');
    
    // Поиск имени Florian
    const florianMatches = html.match(/[^>]*Florian[^<]*/gi);
    console.log('Найдено упоминаний "Florian":', florianMatches ? florianMatches.length : 0);
    if (florianMatches) {
        florianMatches.forEach((match, index) => {
            console.log(`${index + 1}: ${match.trim()}`);
        });
    }
    
    // Поиск "Privater Nutzer"
    const privatMatches = html.match(/[^>]*Privater Nutzer[^<]*/gi);
    console.log('\nНайдено упоминаний "Privater Nutzer":', privatMatches ? privatMatches.length : 0);
    if (privatMatches) {
        privatMatches.forEach((match, index) => {
            console.log(`${index + 1}: ${match.trim()}`);
        });
    }
    
    // Поиск значков
    const badges = ['TOP Zufriedenheit', 'Sehr freundlich', 'Sehr zuverlässig'];
    badges.forEach(badge => {
        const badgeMatches = html.match(new RegExp(`[^>]*${badge}[^<]*`, 'gi'));
        console.log(`\nНайдено упоминаний "${badge}":`, badgeMatches ? badgeMatches.length : 0);
        if (badgeMatches) {
            badgeMatches.forEach((match, index) => {
                console.log(`${index + 1}: ${match.trim()}`);
            });
        }
    });
    
    // Поиск даты
    const dateMatches = html.match(/[^>]*17\.03\.2014[^<]*/gi);
    console.log('\nНайдено упоминаний "17.03.2014":', dateMatches ? dateMatches.length : 0);
    if (dateMatches) {
        dateMatches.forEach((match, index) => {
            console.log(`${index + 1}: ${match.trim()}`);
        });
    }
    
    console.log('\nHTML сохранен в файл orbea-page.html для детального анализа');
    
}).catch(error => {
    console.log('Ошибка:', error.message);
});