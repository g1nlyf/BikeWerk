const { DatabaseManager } = require('../src/js/mysql-config');
const FMVAnalyzer = require('../src/services/FMVAnalyzer');

async function test() {
    const db = new DatabaseManager();
    const analyzer = new FMVAnalyzer(db);

    console.log('🚀 STARTING FMV ANALYZER TEST');

    // Тест 1: YT Capra 2023 (есть ~5 записей из предыдущего сбора)
    console.log('\n📊 Test 1: YT Capra 2023');
    try {
        const capra2023 = await analyzer.getFairMarketValue('YT', 'Capra', 2023);
        console.log(JSON.stringify(capra2023, null, 2));
    } catch (e) {
        console.error('❌ Error:', e);
    }
    
    // Тест 2: YT Capra 2025 (есть ~5 записей)
    console.log('\n📊 Test 2: YT Capra 2025');
    try {
        const capra2025 = await analyzer.getFairMarketValue('YT', 'Capra', 2025);
        console.log(JSON.stringify(capra2025, null, 2));
    } catch (e) {
        console.error('❌ Error:', e);
    }

    // Тест 3: Canyon Neuron 2024 (нет данных → fallback)
    console.log('\n📊 Test 3: Canyon Neuron 2024 (expected estimation)');
    try {
        const neuron2024 = await analyzer.getFairMarketValue('Canyon', 'Neuron', 2024);
        console.log(JSON.stringify(neuron2024, null, 2));
    } catch (e) {
        console.error('❌ Error:', e);
    }

    // Тест 4: Проверка Depreciation Curve
    console.log('\n📉 Test 4: Depreciation Curve for YT Capra (2020-2025)');
    try {
        const curve = analyzer.getDepreciationCurve('YT', 'Capra', [2020, 2021, 2022, 2023, 2024, 2025]);
        console.table(curve);
    } catch (e) {
        console.error('❌ Error:', e);
    }

    // Тест 5: Market Comparison
    console.log('\n⚖️ Test 5: Market Comparison (Price vs FMV)');
    try {
        // Допустим FMV = 2200
        const fmv = 2200;
        const prices = [1500, 1900, 2200, 2500, 3000];
        
        prices.forEach(price => {
            const comparison = analyzer.getMarketComparison(price, fmv);
            console.log(`Price €${price} vs FMV €${fmv}: ${comparison}`);
        });
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

test();