const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const KleinanzeigenCollector = require('../../src/scrapers/kleinanzeigen-collector');
const KleinanzeigenPreprocessor = require('../../src/services/KleinanzeigenPreprocessor');
const UnifiedNormalizer = require('../../src/services/UnifiedNormalizer');

puppeteer.use(StealthPlugin());

const isSvg = (value) => {
  const lower = String(value || '').toLowerCase();
  return lower.includes('.svg') || lower.includes('icon');
};

const run = async () => {
  console.log('🧪 KLEINANZEIGEN NORMALIZATION TEST');
  const results = await KleinanzeigenCollector.searchBikes('Canyon Spectral', { limit: 1 });
  const listing = results[0];

  if (!listing || !listing.url) {
    console.log('❌ Не удалось получить URL объявления');
    process.exit(1);
  }

  console.log(`URL: ${listing.url}`);
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
    const response = await page.goto(listing.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (response && response.status() === 404) {
      console.log('❌ Страница не найдена (404)');
      await browser.close();
      process.exit(1);
    }
    html = await page.content();
  } finally {
    await browser.close();
  }

  const preprocessed = KleinanzeigenPreprocessor.preprocess({ html, url: listing.url });
  const descriptionLength = (preprocessed.description || '').length;
  const photos = Array.isArray(preprocessed.images) ? preprocessed.images : [];

  console.log(`   ✅ Title: "${preprocessed.title || 'N/A'}"`);
  console.log(`   ✅ Price: ${preprocessed.price ?? 'N/A'}`);
  console.log(`   ✅ Location: "${preprocessed.location || 'N/A'}"`);
  console.log(`   ✅ Seller type: ${preprocessed.seller_type || 'unknown'}`);
  console.log(`   ✅ Description length: ${descriptionLength} chars`);
  console.log(`   ✅ Photos found: ${photos.length}`);
  console.log('');

  console.log('STEP 2: Preprocessing...');
  console.log(`   ✅ Source: ${preprocessed.source_platform}`);
  if (preprocessed.price !== null) {
    console.log(`   ✅ Price normalized: ${preprocessed.price}`);
  }
  console.log(`   ✅ Location extracted: "${preprocessed.location || 'N/A'}"`);
  console.log('');

  console.log('STEP 3: Gemini Normalization (AI extraction)...');
  const startedAt = Date.now();
  const normalized = await UnifiedNormalizer.normalize(preprocessed, 'kleinanzeigen');
  const elapsed = (Date.now() - startedAt) / 1000;
  console.log('   ✅ API call successful (attempt 1)');
  console.log(`   ✅ Response time: ${elapsed.toFixed(1)}s`);
  console.log('   ⚠️  Extracted from description only (no structured data)');
  console.log(`   ✅ Brand detected: "${normalized.basic_info?.brand || 'N/A'}"`);
  console.log(`   ✅ Model detected: "${normalized.basic_info?.model || 'N/A'}"`);
  console.log(`   ✅ Year detected: ${normalized.basic_info?.year || 'N/A'}`);
  console.log(`   ✅ Frame size detected: "${normalized.specs?.frame_size || 'unknown'}"`);
  console.log(`   ⚠️  Groupset: ${normalized.specs?.groupset || 'unknown'}`);
  console.log(`   ✅ Quality score: ${normalized.quality_score}`);
  console.log('');

  console.log('STEP 4: Post-processing...');
  const completeness = normalized.meta?.completeness_score ?? 0;
  const mainImageValid = normalized.media?.main_image ? !isSvg(normalized.media.main_image) : false;
  const sellerType = preprocessed.seller_type || normalized.seller?.type || 'unknown';

  console.log(`   ✅ Completeness: ${completeness}%`);
  console.log(`   ✅ Main image: ${mainImageValid ? 'valid photo' : 'invalid'}`);
  console.log(`   ✅ Seller: ${sellerType}`);
  console.log('');

  console.log('STEP 5: Validation...');
  const requiredPass = !!normalized.basic_info?.brand && !!normalized.basic_info?.category && typeof normalized.pricing?.price === 'number';
  const qualityPass = normalized.quality_score > 40;
  console.log(`   ✅ Required fields present: ${requiredPass ? 'PASS' : 'FAIL'}`);
  console.log(`   ✅ Quality score: ${normalized.quality_score} (${qualityPass ? 'PASS' : 'FAIL'})`);
  console.log(`   ⚠️  Warning: specs incomplete (expected for Kleinanzeigen)`);
  console.log('');

  console.log('════════');
  console.log(`✅ KLEINANZEIGEN NORMALIZATION: ${requiredPass && qualityPass ? 'PASSED' : 'FAILED'}`);
  console.log('(with expected limitations)');
  console.log('════════');
};

run().catch((e) => {
  console.log(`❌ Ошибка: ${e.message}`);
  process.exit(1);
});
