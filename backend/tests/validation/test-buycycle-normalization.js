const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const BuycyclePreprocessor = require('../../src/services/BuycyclePreprocessor');
const UnifiedNormalizer = require('../../src/services/UnifiedNormalizer');

puppeteer.use(StealthPlugin());

const url = 'https://buycycle.com/de-de/product/status-160-2022-90020';

const isSvg = (value) => {
  const lower = String(value || '').toLowerCase();
  return lower.includes('.svg') || lower.includes('icon');
};

const pickComponent = (components, keys) => {
  const entries = Object.entries(components || {});
  for (const key of keys) {
    const hit = entries.find(([label]) => label.toLowerCase().includes(key));
    if (hit) return hit[1];
  }
  return null;
};

const extractImagesFromHtml = (html) => {
  const matches = html.match(/https?:\/\/[^"'\\\s]+/g) || [];
  return Array.from(new Set(matches.filter((m) => m.includes('buycycle'))));
};

const run = async () => {
  console.log('🧪 BUYCYCLE NORMALIZATION TEST');
  console.log(`URL: ${url}`);
  console.log('');
  console.log('STEP 1: Scraping raw data...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let html = '';
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (response && response.status() === 404) {
      console.log('❌ Страница не найдена (404)');
      await browser.close();
      process.exit(1);
    }
    html = await page.content();
  } finally {
    await browser.close();
  }

  const rawImages = extractImagesFromHtml(html);
  const svgCount = rawImages.filter(isSvg).length;
  const validCount = rawImages.length - svgCount;

  const preprocessed = BuycyclePreprocessor.preprocess({ html, url });
  const componentCount = Object.keys(preprocessed.components || {}).length;

  console.log(`   ✅ Title: "${preprocessed.title || 'N/A'}"`);
  console.log(`   ✅ Price: ${preprocessed.price ?? 'N/A'}`);
  console.log(`   ✅ Condition: "${preprocessed.condition || 'N/A'}"`);
  console.log(`   ✅ Components found: ${componentCount}`);
  console.log(`   ✅ Photos found: ${rawImages.length} (${validCount} valid, ${svgCount} SVG filtered)`);
  console.log('');

  console.log('STEP 2: Preprocessing...');
  const groupset = pickComponent(preprocessed.components, ['groupset', 'schaltung', 'drivetrain']);
  const brakes = pickComponent(preprocessed.components, ['brake', 'brems']);
  const fork = pickComponent(preprocessed.components, ['fork', 'gabel']);
  const frameSize = preprocessed.frame_size || preprocessed.general_info?.Rahmengröße || preprocessed.general_info?.rahmengröße || null;
  const wheelSize = preprocessed.general_info?.Laufradgröße || preprocessed.general_info?.laufradgröße || null;

  console.log(`   ✅ Source: ${preprocessed.source_platform}`);
  console.log('   ✅ Extracted components:');
  console.log(`      - Groupset: ${groupset || 'unknown'}`);
  console.log(`      - Brakes: ${brakes || 'unknown'}`);
  console.log(`      - Fork: ${fork || 'unknown'}`);
  console.log(`   ✅ General info parsed: frame_size=${frameSize || 'unknown'}, wheel_size=${wheelSize || 'unknown'}`);
  console.log('');

  console.log('STEP 3: Gemini Normalization...');
  const startedAt = Date.now();
  const normalized = await UnifiedNormalizer.normalize(preprocessed, 'buycycle');
  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(`   ✅ API call successful (attempt 1)`);
  console.log(`   ✅ Response time: ${elapsed.toFixed(1)}s`);
  console.log(`   ✅ Quality score: ${normalized.quality_score}`);
  console.log('');

  console.log('STEP 4: Post-processing...');
  const brandCorrected = preprocessed.title?.toLowerCase().includes('status') && normalized.basic_info?.brand === 'Specialized';
  const yearExtracted = normalized.basic_info?.year || null;
  const gallery = Array.isArray(normalized.media?.gallery) ? normalized.media.gallery : [];
  const gallerySvgRemoved = gallery.filter(isSvg).length === 0;
  const completeness = normalized.meta?.completeness_score ?? 0;

  console.log(`   ✅ Brand correction: ${brandCorrected ? 'PASS' : 'FAIL'}`);
  console.log(`   ✅ Year extracted: ${yearExtracted || 'N/A'}`);
  console.log(`   ✅ Image SVG filter: ${gallerySvgRemoved ? 'PASS' : 'FAIL'}`);
  console.log(`   ✅ Completeness: ${completeness}%`);
  console.log('');

  console.log('STEP 5: Validation...');
  const required = {
    brand: normalized.basic_info?.brand,
    model: normalized.basic_info?.model,
    category: normalized.basic_info?.category,
    price: normalized.pricing?.price
  };
  const requiredPass = !!required.brand && !!required.model && !!required.category && typeof required.price === 'number';
  const qualityPass = normalized.quality_score > 40;
  const mainImage = normalized.media?.main_image || 'N/A';

  console.log(`   ✅ Required fields present: ${requiredPass ? 'PASS' : 'FAIL'}`);
  console.log(`   ✅ Quality score: ${normalized.quality_score} (${qualityPass ? 'PASS' : 'FAIL'})`);
  console.log(`   ✅ Main image: ${mainImage}`);
  console.log(`   ✅ Gallery: ${gallery.length} photos`);
  console.log('');

  console.log('══════════');
  console.log(`✅ BUYCYCLE NORMALIZATION: ${requiredPass && qualityPass ? 'PASSED' : 'FAILED'}`);
  console.log('══════════');
  console.log('Final JSON (abbreviated):');
  console.log(JSON.stringify({
    meta: { source_platform: normalized.meta?.source_platform },
    basic_info: {
      brand: normalized.basic_info?.brand,
      model: normalized.basic_info?.model,
      year: normalized.basic_info?.year,
      category: normalized.basic_info?.category
    },
    pricing: { price: normalized.pricing?.price, currency: normalized.pricing?.currency },
    specs: {
      frame_size: normalized.specs?.frame_size,
      groupset: normalized.specs?.groupset,
      brakes: normalized.specs?.brakes,
      fork: normalized.specs?.fork
    },
    condition: { score: normalized.condition?.score, grade: normalized.condition?.grade },
    media: { main_image: normalized.media?.main_image, gallery: normalized.media?.gallery },
    quality_score: normalized.quality_score,
    completeness: normalized.meta?.completeness_score
  }, null, 2));
};

run().catch((e) => {
  console.log(`❌ Ошибка: ${e.message}`);
  process.exit(1);
});
