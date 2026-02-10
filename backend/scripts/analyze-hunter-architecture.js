const fs = require('fs');
const path = require('path');

/**
 * АНАЛИЗ АРХИТЕКТУРЫ HUNTER
 * Собирает все пути, зависимости и документацию
 */

console.log('='.repeat(80));
console.log('🕵️  HUNTER ARCHITECTURE ANALYZER');
console.log('='.repeat(80));
console.log('\n');

const results = {
  timestamp: new Date().toISOString(),
  project_root: path.join(__dirname, '../..'),
  components: {},
  missing_files: [],
  analysis: {}
};

// ============================================
// 1. ПРОВЕРКА СУЩЕСТВОВАНИЯ КЛЮЧЕВЫХ ФАЙЛОВ
// ============================================
console.log('📂 CHECKING KEY FILES:\n');

const keyFiles = {
  // Главные сервисы
  'hunter_service': 'backend/src/services/autoHunter.js',
  'auto_hunter': 'backend/cron/hourly-hunter.js',
  'autonomous_orchestrator': 'telegram-bot/AutonomousOrchestrator.js',
  'unified_hunter': 'telegram-bot/unified-hunter.js',
  
  // Конфигурация
  'brands_config': 'backend/config/brands-config.json',
  'categories_config': 'backend/config/categories.json',
  
  // Gap Analyzer
  'gap_analyzer': 'backend/src/services/catalog-gap-analyzer.js',
  
  // Коллекторы
  'buycycle_collector': 'backend/scrapers/buycycle-collector.js',
  
  // Normalizers
  'unified_normalizer': 'backend/src/services/UnifiedNormalizer.js',
  'buycycle_preprocessor': 'backend/src/services/BuycyclePreprocessor.js',
  
  // Gemini
  'gemini_processor': 'backend/src/services/geminiProcessor.js',
  
  // Database
  'database_service': 'backend/src/services/DatabaseService.js',
  
  // Photo Manager
  'photo_manager': 'backend/src/services/PhotoManager.js'
};

for (const [name, relativePath] of Object.entries(keyFiles)) {
  const fullPath = path.join(results.project_root, relativePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    const stats = fs.statSync(fullPath);
    results.components[name] = {
      path: relativePath,
      full_path: fullPath,
      exists: true,
      size: stats.size,
      modified: stats.mtime
    };
    console.log(`   ✅ ${name.padEnd(30)} - ${relativePath}`);
  } else {
    results.missing_files.push({ name, path: relativePath });
    console.log(`   ❌ ${name.padEnd(30)} - NOT FOUND: ${relativePath}`);
  }
}

// ============================================
// 2. АНАЛИЗ ЗАВИСИМОСТЕЙ (imports/requires)
// ============================================
console.log('\n\n🔗 ANALYZING DEPENDENCIES:\n');

function extractDependencies(filePath) {
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, 'utf8');
  const deps = [];
  
  // require()
  const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
  for (const match of requireMatches) {
    deps.push({ type: 'require', module: match[1] });
  }
  
  // import
  const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    deps.push({ type: 'import', module: match[1] });
  }
  
  return deps;
}

// Анализируем главные файлы
const mainFiles = [
  'autonomous_orchestrator',
  'unified_hunter',
  'buycycle_collector',
  'unified_normalizer',
  'gemini_processor'
];

mainFiles.forEach(fileKey => {
  if (results.components[fileKey]) {
    const deps = extractDependencies(results.components[fileKey].full_path);
    results.components[fileKey].dependencies = deps;
    
    console.log(`   📦 ${fileKey}:`);
    deps.slice(0, 5).forEach(dep => {
      console.log(`      - ${dep.module}`);
    });
    if (deps.length > 5) {
      console.log(`      ... and ${deps.length - 5} more`);
    }
    console.log('');
  }
});

// ============================================
// 3. АНАЛИЗ КОНФИГУРАЦИИ
// ============================================
console.log('\n🔧 ANALYZING CONFIGURATION:\n');

if (results.components.brands_config) {
  try {
    const brandsConfig = JSON.parse(
      fs.readFileSync(results.components.brands_config.full_path, 'utf8')
    );
    
    results.analysis.brands = {
      total: Object.keys(brandsConfig).length,
      tier1: Object.values(brandsConfig).filter(b => b.tier === 1).length,
      tier2: Object.values(brandsConfig).filter(b => b.tier === 2).length,
      sample: Object.keys(brandsConfig).slice(0, 5)
    };
    
    console.log(`   ✅ Brands config loaded`);
    console.log(`      Total brands: ${results.analysis.brands.total}`);
    console.log(`      Tier 1: ${results.analysis.brands.tier1}`);
    console.log(`      Tier 2: ${results.analysis.brands.tier2}`);
    console.log(`      Sample: ${results.analysis.brands.sample.join(', ')}`);
  } catch (e) {
    console.log(`   ❌ Failed to parse brands config: ${e.message}`);
  }
}

// ============================================
// 4. ПОИСК КРИТИЧЕСКИХ ФУНКЦИЙ
// ============================================
console.log('\n\n🔍 SEARCHING FOR KEY FUNCTIONS:\n');

const functionsToFind = {
  'replenishCatalog': 'autonomous_orchestrator',
  'buildTargets': 'unified_hunter',
  'analyzeModelGaps': 'gap_analyzer',
  'collect': 'buycycle_collector',
  'normalize': 'unified_normalizer',
  'analyzeBikeToUnifiedFormat': 'gemini_processor',
  'insertBike': 'database_service'
};

for (const [funcName, fileKey] of Object.entries(functionsToFind)) {
  if (results.components[fileKey]) {
    const content = fs.readFileSync(results.components[fileKey].full_path, 'utf8');
    
    // Ищем определение функции
    const patterns = [
      new RegExp(`function\\s+${funcName}\\s*\\(`, 'g'),
      new RegExp(`${funcName}\\s*:\\s*function\\s*\\(`, 'g'),
      new RegExp(`${funcName}\\s*=\\s*function\\s*\\(`, 'g'),
      new RegExp(`${funcName}\\s*\\(.*?\\)\\s*{`, 'g'),
      new RegExp(`async\\s+${funcName}\\s*\\(`, 'g')
    ];
    
    let found = false;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        found = true;
        break;
      }
    }
    
    console.log(`   ${found ? '✅' : '❌'} ${funcName.padEnd(30)} in ${fileKey}`);
  }
}

// ============================================
// 5. АНАЛИЗ ПОТОКА ДАННЫХ
// ============================================
console.log('\n\n📊 DATA FLOW ANALYSIS:\n');

const dataFlow = [
  {
    step: 1,
    name: 'Trigger',
    files: ['hourly-hunter.js', 'AutonomousOrchestrator.js'],
    output: 'replenishCatalog(count)'
  },
  {
    step: 2,
    name: 'Gap Analysis',
    files: ['catalog-gap-analyzer.js'],
    output: 'targets[] (brand, model, size, price)'
  },
  {
    step: 3,
    name: 'URL Building',
    files: ['unified-hunter.js', 'buycycle-collector.js'],
    output: 'searchUrls[]'
  },
  {
    step: 4,
    name: 'Data Collection',
    files: ['buycycle-collector.js', 'buycycle-fetcher.js'],
    output: 'raw HTML/JSON'
  },
  {
    step: 5,
    name: 'Parsing',
    files: ['buycycle-parser.js'],
    output: 'parsed data object'
  },
  {
    step: 6,
    name: 'Normalization',
    files: ['UnifiedNormalizer.js', 'BuycyclePreprocessor.js'],
    output: 'preprocessed data'
  },
  {
    step: 7,
    name: 'AI Processing',
    files: ['geminiProcessor.js'],
    output: 'unified JSON'
  },
  {
    step: 8,
    name: 'Photo Processing',
    files: ['PhotoManager.js'],
    output: 'CDN URLs'
  },
  {
    step: 9,
    name: 'Database Insert',
    files: ['database-service.js'],
    output: 'bike_id'
  }
];

dataFlow.forEach(step => {
  console.log(`   ${step.step}. ${step.name.padEnd(20)} → ${step.output}`);
  step.files.forEach(file => {
    const exists = Object.values(results.components).some(c => c.path.includes(file));
    console.log(`      ${exists ? '✅' : '❌'} ${file}`);
  });
  console.log('');
});

// ============================================
// 6. ГЕНЕРАЦИЯ ОТЧЕТА
// ============================================
console.log('\n' + '='.repeat(80));
console.log('📄 GENERATING REPORT...\n');

const reportPath = path.join(__dirname, '../../docs/reports/hunter-architecture-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

console.log(`✅ Report saved to: ${reportPath}`);

// Краткая сводка
console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY');
console.log('='.repeat(80));
console.log(`\nTotal files checked: ${Object.keys(keyFiles).length}`);
console.log(`Files found: ${Object.keys(results.components).length}`);
console.log(`Files missing: ${results.missing_files.length}`);

if (results.missing_files.length > 0) {
  console.log('\n❌ MISSING FILES:');
  results.missing_files.forEach(f => {
    console.log(`   - ${f.name}: ${f.path}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('✅ Analysis complete!\n');
