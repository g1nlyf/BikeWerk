const BuycycleFetcher = require('../utils/buycycle-fetcher');
const BuycycleParser = require('../parsers/buycycle-parser');
const fs = require('fs');
const path = require('path');

/**
 * LIVE TEST: Скачивание + Парсинг
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('BUYCYCLE LIVE TEST - FETCH + PARSE');
  console.log('='.repeat(80));
  
  // ✅ ПРАВИЛЬНЫЙ URL
  const url = 'https://buycycle.com/de-de/product/tues-comp-2021-26483';
  
  try {
    // 1. Скачиваем HTML
    const htmlPath = path.join(__dirname, 'selector-discovery', 'buycycle_sample_live.html');
    
    const html = await BuycycleFetcher.fetch(url, {
      saveToFile: htmlPath,
      timeout: 30000
    });
    
    console.log('\n' + '-'.repeat(80));
    
    // 2. Парсим
    const data = BuycycleParser.parse(html, url);
    
    // 3. Валидация
    const validation = BuycycleParser.validate(data);
    
    console.log('\n' + '-'.repeat(80));
    console.log('\n📊 PARSED DATA\n');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n' + '-'.repeat(80));
    console.log('\n✅ VALIDATION\n');
    console.log(`Valid: ${validation.is_valid}`);
    
    if (validation.errors.length > 0) {
      console.log(`\n❌ Errors (${validation.errors.length}):`);
      validation.errors.forEach(e => console.log(`   - ${e}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${validation.warnings.length}):`);
      validation.warnings.forEach(w => console.log(`   - ${w}`));
    }
    
    // 4. Сохраняем результат
    const outputDir = path.join(__dirname, '../../test-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'buycycle_live_parsed.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`\n💾 Results saved to:\n   ${outputPath}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Запускаем
main();
