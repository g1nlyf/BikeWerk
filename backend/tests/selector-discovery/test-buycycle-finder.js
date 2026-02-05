const fs = require('fs');
const path = require('path');
const SelectorFinder = require('../../utils/selector-finder');
const searchMap = require('./buycycle-searchmap');

console.log('\n🚴 BUYCYCLE SELECTOR AUTO-DISCOVERY\n');
console.log('='.repeat(80));

const htmlPath = path.join(__dirname, 'buycycle_sample.html');

if (!fs.existsSync(htmlPath)) {
  console.log('\n❌ ОШИБКА: Файл buycycle_sample.html не найден!');
  console.log('\n📝 ИНСТРУКЦИЯ:');
  console.log('1. Открой: https://buycycle.com/de-de/b/yt-industries-tues-comp-2021');
  console.log('2. Подожди загрузки страницы (2-3 сек)');
  console.log('3. Ctrl+S → "Веб-страница, только HTML"');
  console.log('4. Сохрани как: buycycle_sample.html');
  console.log('5. Перемести в: backend\\tests\\selector-discovery\\');
  console.log('6. Запусти скрипт снова: node backend/tests/selector-discovery/test-buycycle-finder.js\n');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
console.log(`✅ HTML загружен (${html.length} символов)\n`);

console.log('🔍 Запуск автоматического поиска селекторов...\n');

const results = SelectorFinder.findSelectors(html, searchMap);
const report = SelectorFinder.generateReport(results, html);

const outputDir = path.join(__dirname, '../../../test-results');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'buycycle_selectors.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log(`\n💾 Результаты сохранены в: ${outputPath}`);

const found = Object.values(results).filter(r => r.found).length;
const total = Object.keys(results).length;
const percentage = Math.round((found / total) * 100);

console.log('\n📊 СТАТИСТИКА:');
console.log(`   Найдено: ${found}/${total} (${percentage}%)`);
console.log(`   Не найдено: ${total - found}`);

if (percentage < 80) {
  console.log('\n⚠️  ВНИМАНИЕ: Менее 80% селекторов найдено!');
}

console.log('\n' + '='.repeat(80));
console.log('✅ ГОТОВО! Проверь buycycle_selectors.json\n');
