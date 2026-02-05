const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const KleinanzeigenParser = require('../../parsers/kleinanzeigen-parser');

const HTML_FILE_PATH = 'C:/Users/hacke/CascadeProjects/Finals1/eubike/backend/tests/validation/kleinanzeigen_canyon.html';
const TEST_URL = 'https://www.kleinanzeigen.de/s-anzeige/canyon-spectral-cf-7-2021-groesse-m/3163035521-217-8169';

async function testParser() {
  console.log('\n' + '='.repeat(80));
  console.log('KLEINANZEIGEN PARSER TEST');
  console.log('URL:', TEST_URL);
  console.log('='.repeat(80) + '\n');
  
  // Load HTML
  if (!fs.existsSync(HTML_FILE_PATH)) {
    console.error('❌ HTML file not found!');
    return;
  }
  
  const html = fs.readFileSync(HTML_FILE_PATH, 'utf-8');
  console.log(`✅ HTML loaded (${html.length} chars)\n`);
  
  // Parse
  console.log('Parsing...\n');
  const data = KleinanzeigenParser.parse(html, TEST_URL);
  
  // Display results
  console.log('-'.repeat(80));
  console.log('\n📊 PARSED DATA\n');
  console.log(JSON.stringify(data, null, 2));
  
  // Validate
  console.log('\n' + '-'.repeat(80));
  const validation = KleinanzeigenParser.validate(data);
  
  console.log('\n✅ VALIDATION\n');
  console.log(`Valid: ${validation.is_valid}`);
  
  if (validation.errors.length > 0) {
    console.log(`\n❌ Errors (${validation.errors.length}):`);
    validation.errors.forEach(err => console.log(`   - ${err}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log(`\n⚠️ Warnings (${validation.warnings.length}):`);
    validation.warnings.forEach(warn => console.log(`   - ${warn}`));
  }
  
  // Save results
  const outputDir = path.join(__dirname, '../../../test-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'kleinanzeigen_parsed_data.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    url: TEST_URL,
    data,
    validation
  }, null, 2));
  
  console.log(`\n💾 Results saved to:\n   ${outputPath}\n`);
  console.log('='.repeat(80) + '\n');
}

testParser().catch(console.error);
