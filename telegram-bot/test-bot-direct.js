const GroqIntegration = require('./groq-integration');
const groq = new GroqIntegration();

const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/orbea-rallon-only-frame-angebotm-team-rahmengroesse-m-enduro-mtb/2980937338-217-6146';

console.log('🧪 Тестирование парсинга через бота...');
console.log('📋 URL:', testUrl);

const expectedSeller = {
    name: 'Florian',
    type: 'Privater Nutzer',
    badges: ['TOP Zufriedenheit', 'Sehr freundlich', 'Sehr zuverlässig'],
    memberSince: '17.03.2014',
    rating: null
};

console.log('📋 Ожидаемые данные продавца:');
console.log('   • Имя:', expectedSeller.name);
console.log('   • Тип:', expectedSeller.type);
console.log('   • Значки:', expectedSeller.badges.join(', '));
console.log('   • Активен с:', expectedSeller.memberSince);

groq.parseUrl(testUrl)
    .then(result => {
        console.log('\n🔍 Результаты парсинга:');
        console.log('📊 Полная структура ответа:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            const seller = result.seller;
            console.log('\n✅ Парсинг успешен!');
            console.log('📊 Данные продавца:');
            console.log('   • Имя:', seller?.name || 'НЕ НАЙДЕНО');
            console.log('   • Тип:', seller?.type || 'НЕ НАЙДЕНО');
            console.log('   • Значки:', seller?.badges ? seller.badges.join(', ') : 'НЕ НАЙДЕНО');
            console.log('   • Активен с:', seller?.memberSince || 'НЕ НАЙДЕНО');
            console.log('   • Рейтинг:', seller?.rating || 'НЕ НАЙДЕНО');
            
            // Проверка соответствия
            console.log('\n🔍 Проверка соответствия:');
            console.log('   • Имя:', seller?.name === expectedSeller.name ? '✅' : '❌');
            console.log('   • Тип:', seller?.type === expectedSeller.type ? '✅' : '❌');
            console.log('   • Дата:', seller?.memberSince === expectedSeller.memberSince ? '✅' : '❌');
            
            if (seller?.badges && seller.badges.length > 0) {
                const foundBadges = expectedSeller.badges.filter(badge => 
                    seller.badges.some(found => found.includes(badge.replace('&nbsp;', ' ')))
                );
                console.log('   • Значки:', foundBadges.length === expectedSeller.badges.length ? '✅' : '❌');
                console.log('     Найдено:', foundBadges.length, 'из', expectedSeller.badges.length);
            } else {
                console.log('   • Значки: ❌ (не найдены)');
            }
            
        } else {
            console.log('\n❌ Ошибка парсинга:', result.error);
        }
    })
    .catch(error => {
        console.log('\n❌ Ошибка:', error.message);
    });