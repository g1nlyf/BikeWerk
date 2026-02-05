const KleinanzeigenParser = require('./kleinanzeigen-parser');
const GeminiProcessor = require('./gemini-processor');

async function testParsing() {
    const testUrl = 'https://www.kleinanzeigen.de/s-anzeige/commencal-meta-am-v4-2/3213920058-217-7433?utm_source=telegram&utm_campaign=socialbuttons&utm_medium=social&utm_content=app_ios';
    
    console.log('🔍 Тестируем парсинг объявления:', testUrl);
    console.log('=' .repeat(80));
    
    try {
        const parser = new KleinanzeigenParser();
        const geminiProcessor = new GeminiProcessor();
        
        console.log('📥 Парсим данные...');
        const rawData = await parser.parseKleinanzeigenLink(testUrl);
        
        console.log('\n📋 СЫРЫЕ ДАННЫЕ ИЗ ПАРСЕРА:');
        console.log('Title:', rawData.title);
        console.log('Price:', rawData.price);
        console.log('Description:', rawData.description ? `"${rawData.description}"` : 'ПУСТОЕ');
        console.log('Location:', rawData.location);
        console.log('Condition:', rawData.condition);
        console.log('Brand:', rawData.brand);
        console.log('Model:', rawData.model);
        console.log('Category:', rawData.category);
        console.log('isNegotiable:', rawData.isNegotiable);
        console.log('deliveryOption:', rawData.deliveryOption);
        console.log('frameSize:', rawData.frameSize);
        console.log('wheelDiameter:', rawData.wheelDiameter);
        console.log('year:', rawData.year);
        
        console.log('\n🤖 Обрабатываем через Gemini...');
        const processedData = await geminiProcessor.processBikeData(rawData);
        
        console.log('\n✅ ОБРАБОТАННЫЕ ДАННЫЕ:');
        console.log(JSON.stringify(processedData, null, 2));
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.message);
        console.error(error.stack);
    }
}

testParsing();