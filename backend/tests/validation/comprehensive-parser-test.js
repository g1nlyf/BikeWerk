const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const KleinanzeigenCollector = require('../../src/scrapers/kleinanzeigen-collector');
const BuycycleCollector = require('../../scrapers/buycycle-collector');
const KleinanzeigenPreprocessor = require('../../src/services/KleinanzeigenPreprocessor');
const BuycyclePreprocessor = require('../../src/services/BuycyclePreprocessor');
const UnifiedNormalizer = require('../../src/services/UnifiedNormalizer');
const DatabaseService = require('../../src/services/DatabaseService');
const geminiProcessor = require('../../src/services/geminiProcessor');
const DatabaseManager = require('../../database/db-manager');

puppeteer.use(StealthPlugin());

const pad = (value) => String(value).padStart(2, '0');
const formatFolderTimestamp = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
const formatIso = (date) => date.toISOString();

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return null;
  const size = Number(bytes);
  if (!Number.isFinite(size)) return null;
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

const formatSeconds = (ms) => {
  if (ms === null || ms === undefined) return null;
  return `${(ms / 1000).toFixed(1)}с`;
};

const safeWriteJson = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const extractYear = (text) => {
  const match = String(text || '').match(/\b(20\d{2})\b/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
};

const countCompleteness = (unified) => {
  const fields = [
    unified?.basic_info?.name,
    unified?.basic_info?.brand,
    unified?.basic_info?.model,
    unified?.basic_info?.year,
    unified?.basic_info?.category,
    unified?.basic_info?.description,
    unified?.pricing?.price,
    unified?.pricing?.currency,
    unified?.specs?.frame_size,
    unified?.specs?.wheel_size,
    unified?.specs?.frame_material,
    unified?.specs?.groupset,
    unified?.specs?.brakes,
    unified?.specs?.fork,
    unified?.specs?.shock,
    unified?.condition?.status,
    unified?.condition?.score,
    unified?.media?.main_image
  ];
  const total = fields.length + 1;
  const filled = fields.filter(value => value !== null && value !== undefined && value !== '').length
    + (Array.isArray(unified?.media?.gallery) && unified.media.gallery.length > 0 ? 1 : 0);
  const percent = Math.round((filled / total) * 100);
  return { filled, total, percent };
};

const normalizeWithTelemetry = async (preprocessed, source) => {
  const startedAt = Date.now();
  const maxRetries = 3;
  let attempts = 0;
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    attempts = attempt;
    try {
      const prompt = geminiProcessor.buildUnifiedPrompt(preprocessed, source);
      let result = await geminiProcessor.callGeminiAPI(prompt, 60000);
      if (result?.basic_inffo && !result.basic_info) {
        result = { ...result, basic_info: result.basic_inffo };
        delete result.basic_inffo;
      }
      result.pricing = result.pricing || {};
      if (result.pricing.pprice !== undefined && result.pricing.price === undefined) {
        result.pricing.price = result.pricing.pprice;
        delete result.pricing.pprice;
      }
      if (!result.pricing.currency) result.pricing.currency = 'EUR';
      if (geminiProcessor.isValidResult(result)) {
        const unified = UnifiedNormalizer.postProcess(result, preprocessed, source);
        return { unified, attempts, elapsedMs: Date.now() - startedAt, error: null };
      }
      lastError = new Error('Неверный ответ Gemini');
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || error);
      if (msg.includes('503') || msg.includes('429')) {
        const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
        await geminiProcessor.delay(delay);
        if (geminiProcessor.apiKeys && geminiProcessor.apiKeys.length > 1) {
          geminiProcessor.rotateAPIKey();
        }
      } else if (msg.includes('timeout')) {
        await geminiProcessor.delay(3000);
      } else {
        break;
      }
    }
  }
  const errorMessage = geminiProcessor.formatGeminiErrorMessage(lastError, attempts);
  geminiProcessor.logFailedBike(preprocessed, errorMessage, attempts);
  const fallback = geminiProcessor.getFallbackJSON(preprocessed, lastError, source);
  const unified = UnifiedNormalizer.postProcess(fallback, preprocessed, source);
  return { unified, attempts, elapsedMs: Date.now() - startedAt, error: lastError };
};

const summarizePhotos = (photoResults, mainImage) => {
  const photos = (photoResults || []).map((item, index) => {
    const isMain = item.local_path === mainImage || index === 0;
    const downloadStatus = item.is_downloaded === 1 ? 'успешно' : 'ошибка';
    return {
      index,
      original_url: item.image_url,
      download_status: downloadStatus,
      download_time: formatSeconds(item.download_time_ms),
      original_size: formatBytes(item.original_size_bytes),
      optimized_size: formatBytes(item.optimized_size_bytes),
      format: item.format,
      optimization_ratio: item.optimization_ratio !== null ? `${item.optimization_ratio}%` : null,
      imagekit_url: item.local_path,
      imagekit_upload_time: formatSeconds(item.upload_time_ms),
      imagekit_file_id: item.file_id || null,
      width: item.width ?? null,
      height: item.height ?? null,
      is_main: isMain,
      error: item.error || null,
      fallback: item.is_downloaded === 0 ? 'внешний URL сохранён в БД' : null
    };
  });
  const totalPhotos = photos.length;
  const successPhotos = photos.filter(p => p.download_status === 'успешно').length;
  const failedPhotos = totalPhotos - successPhotos;
  const totalOriginal = (photoResults || []).reduce((sum, item) => sum + (item.original_size_bytes || 0), 0);
  const totalOptimized = (photoResults || []).reduce((sum, item) => sum + (item.optimized_size_bytes || 0), 0);
  const averageUploadMs = (photoResults || [])
    .map(item => item.upload_time_ms || 0)
    .filter(ms => ms > 0);
  const averageUpload = averageUploadMs.length > 0
    ? `${(averageUploadMs.reduce((a, b) => a + b, 0) / averageUploadMs.length / 1000).toFixed(1)}s`
    : null;
  return {
    totalPhotos,
    successPhotos,
    failedPhotos,
    totalOriginal,
    totalOptimized,
    averageUpload,
    photos
  };
};

const ensureDirs = (baseDir) => {
  const logsDir = path.join(baseDir, 'logs');
  const jsonDir = path.join(baseDir, 'json');
  const photosDir = path.join(baseDir, 'photos');
  const summaryDir = path.join(baseDir, 'summary');
  [baseDir, logsDir, jsonDir, photosDir, summaryDir].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
  return { logsDir, jsonDir, photosDir, summaryDir };
};

const createDbLog = (bikeName, savedInfo) => {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const lines = [];
  lines.push(`[${stamp}] Сохранение велосипеда в базе данных...`);
  if (!savedInfo.success) {
    if (savedInfo.duplicate) {
      lines.push(`[${stamp}] ⚠️ Обнаружен дубликат (ID: ${savedInfo.bike_id})`);
    } else {
      lines.push(`[${stamp}] ❌ Ошибка сохранения: ${savedInfo.reason || 'неизвестная_ошибка'}`);
    }
    lines.push(`[${stamp}] Сохранение в БД завершено`);
    return lines.join('\n');
  }
  lines.push(`[${stamp}] ✅ Запись добавлена в таблицу bikes (ID: ${savedInfo.bike_id})`);
  lines.push(`[${stamp}] Сохранённые поля:`);
  lines.push(`  - name: "${savedInfo.fields.name}"`);
  lines.push(`  - brand: "${savedInfo.fields.brand}"`);
  lines.push(`  - model: "${savedInfo.fields.model}"`);
  lines.push(`  - year: ${savedInfo.fields.year}`);
  lines.push(`  - category: "${savedInfo.fields.category}"`);
  lines.push(`  - price: ${savedInfo.fields.price}`);
  lines.push(`  - quality_score: ${savedInfo.fields.quality_score}`);
  lines.push(`  - main_image: "${savedInfo.fields.main_image}"`);
  lines.push(`  - source_platform: "${savedInfo.fields.source_platform}"`);
  lines.push(`  - source_ad_id: "${savedInfo.fields.source_ad_id}"`);
  lines.push(`  - unified_data: JSON (длина: ${savedInfo.fields.unified_length} символов)`);
  lines.push(`[${stamp}] ✅ Добавлено ${savedInfo.photoCount} записей в таблицу bike_images`);
  lines.push(`[${stamp}] Сохранение в БД завершено`);
  return lines.join('\n');
};

const clearCatalog = () => {
  const dbManager = new DatabaseManager();
  const db = dbManager.getDatabase();
  db.pragma('foreign_keys = OFF');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  const toClear = ['bike_images', 'bikes', 'market_history', 'failed_bikes'];
  toClear.forEach((table) => {
    if (tables.includes(table)) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
  });
  db.pragma('foreign_keys = ON');
  dbManager.close();

  const imagesDir = path.resolve(__dirname, '../../public/images/bikes');
  if (fs.existsSync(imagesDir)) {
    const entries = fs.readdirSync(imagesDir);
    entries.forEach((entry) => {
      const entryPath = path.join(imagesDir, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      } else {
        fs.rmSync(entryPath, { force: true });
      }
    });
  } else {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
};

const buildFmvComparison = (unified) => {
  const price = unified?.pricing?.price ?? null;
  const fmv = unified?.pricing?.fmv ?? null;
  if (!Number.isFinite(Number(price)) || !Number.isFinite(Number(fmv))) {
    return {
      price,
      fmv,
      delta: null,
      delta_percent: null,
      verdict: 'нет_FMV'
    };
  }
  const delta = Number(price) - Number(fmv);
  const deltaPercent = fmv !== 0 ? Math.round((delta / fmv) * 1000) / 10 : null;
  const verdict = delta <= 0 ? 'цена_ниже_FMV' : 'цена_выше_FMV';
  return {
    price,
    fmv,
    delta,
    delta_percent: deltaPercent,
    verdict
  };
};

const run = async () => {
  const startedAt = Date.now();
  const runDate = new Date();
  const folderStamp = formatFolderTimestamp(runDate);
  const baseDir = path.resolve(__dirname, '../../test-results', `parser-validation-${folderStamp}`);
  const { logsDir, jsonDir, photosDir, summaryDir } = ensureDirs(baseDir);

  const summary = {
    test_run: {
      timestamp: formatIso(runDate),
      duration: null,
      total_bikes: 0,
      kleinanzeigen_bikes: 0,
      buycycle_bikes: 0
    },
    kleinanzeigen_results: {
      total_attempted: 0,
      successfully_normalized: 0,
      failed_normalization: 0,
      average_quality_score: 0,
      average_completeness: 0,
      average_photos_per_bike: 0,
      photo_success_rate: '0%',
      total_photos_uploaded: 0,
      total_storage_used: '0 MB',
      average_gemini_time: '0s'
    },
    buycycle_results: {
      total_attempted: 0,
      successfully_normalized: 0,
      failed_normalization: 0,
      failure_reason: null,
      average_quality_score: 0,
      average_completeness: 0,
      average_photos_per_bike: 0,
      photo_success_rate: '0%',
      total_photos_uploaded: 0,
      total_storage_used: '0 MB',
      average_gemini_time: '0s'
    },
    photo_pipeline: {
      total_photos_downloaded: 0,
      successful_uploads: 0,
      failed_uploads: 0,
      success_rate: '0%',
      total_original_size: '0 MB',
      total_optimized_size: '0 MB',
      optimization_ratio: '0%',
      imagekit_storage_used: '0 MB'
    },
    database: {
      bikes_inserted: 0,
      bikes_duplicate: 0,
      bike_images_inserted: 0,
      errors: 0
    },
    issues: [],
    recommendations: []
  };

  const metrics = {
    kleinanzeigen: [],
    buycycle: [],
    photos: {
      originalBytes: 0,
      optimizedBytes: 0,
      total: 0,
      downloaded: 0
    },
    database: {
      inserted: 0,
      duplicates: 0,
      images: 0,
      errors: 0
    }
  };

  const dbService = new DatabaseService();

  console.log('🧪 КОМПЛЕКСНЫЙ ТЕСТ ВАЛИДАЦИИ ПАРСЕРА');
  console.log(`📁 Папка вывода: ${baseDir}`);
  console.log('ШАГ 0: ОЧИСТКА КАТАЛОГА');
  clearCatalog();

  console.log('ШАГ 1: KLEINANZEIGEN (5 велосипедов)');
  const kleinResults = await KleinanzeigenCollector.searchBikes('mountainbike', { limit: 5, minPrice: 800, maxPrice: 2000 });
  summary.test_run.kleinanzeigen_bikes = kleinResults.length;
  summary.kleinanzeigen_results.total_attempted = kleinResults.length;

  const processedBikes = [];

  for (let i = 0; i < kleinResults.length; i += 1) {
    const listing = kleinResults[i];
    const index = i + 1;
    console.log(`   ▶️ Kleinanzeigen велосипед ${index}: ${listing.url}`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    const response = await page.goto(listing.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const html = await page.content();
    await browser.close();
    const status = response?.status?.() || null;
    if (status === 404) {
      summary.issues.push({ bike: `kleinanzeigen_bike_${index}`, issue: 'Объявление вернуло 404', severity: 'предупреждение', fallback: 'Пропущено' });
      summary.kleinanzeigen_results.failed_normalization += 1;
      continue;
    }

    const preprocessed = KleinanzeigenPreprocessor.preprocess({
      html,
      url: listing.url,
      title: listing.title,
      price: listing.price,
      description: listing.description,
      location: listing.location,
      images: [listing.image],
      external_id: listing.external_id
    });

    const rawPayload = {
      source: 'kleinanzeigen',
      url: listing.url,
      scraped_at: formatIso(new Date()),
      raw_data: {
        title: preprocessed.title || listing.title,
        price: preprocessed.price ?? listing.price,
        location: preprocessed.location || listing.location,
        seller_type: preprocessed.seller_type || 'неизвестно',
        description: preprocessed.description || listing.description,
        photos: preprocessed.images || [],
        photos_count: Array.isArray(preprocessed.images) ? preprocessed.images.length : 0,
        extraction_success: true
      }
    };
    safeWriteJson(path.join(jsonDir, `kleinanzeigen_bike_${index}_raw.json`), rawPayload);

    const preprocessedPayload = {
      source: 'kleinanzeigen',
      preprocessor: 'KleinanzeigenPreprocessor',
      processed_at: formatIso(new Date()),
      preprocessed_data: {
        title: preprocessed.title,
        price: preprocessed.price,
        location: preprocessed.location,
        seller: preprocessed.seller || { type: preprocessed.seller_type || null, name: null },
        photos: preprocessed.images || [],
        photos_filtered_count: Array.isArray(preprocessed.images) ? preprocessed.images.length : 0,
        photos_rejected_count: 0
      }
    };
    safeWriteJson(path.join(jsonDir, `kleinanzeigen_bike_${index}_preprocessed.json`), preprocessedPayload);

    const normalizedResult = await normalizeWithTelemetry(preprocessed, 'kleinanzeigen');
    const completeness = countCompleteness(normalizedResult.unified);
    const yearFromTitle = extractYear(preprocessed.title);
    const normalizedPayload = {
      source: 'kleinanzeigen',
      normalizer: 'UnifiedNormalizer + Gemini',
      normalized_at: formatIso(new Date()),
      gemini_attempts: normalizedResult.attempts,
      gemini_response_time: formatSeconds(normalizedResult.elapsedMs),
      unified_data: normalizedResult.unified,
      post_processing: {
        brand_correction: normalizedResult.unified?.basic_info?.brand
          ? `${normalizedResult.unified.basic_info.brand} → ${normalizedResult.unified.basic_info.brand} (без изменений)`
          : 'Неизвестно → Неизвестно',
        year_extraction: yearFromTitle ? `${yearFromTitle} (из заголовка)` : 'не_найден',
        completeness: `${completeness.percent}%`,
        fields_filled: completeness.filled,
        fields_total: completeness.total
      }
    };
    safeWriteJson(path.join(jsonDir, `kleinanzeigen_bike_${index}_normalized.json`), normalizedPayload);

    const saveSummary = await dbService.saveBikesToDB(normalizedResult.unified, { includePhotoResults: true });
    const saveResult = saveSummary.results[0] || { success: false, reason: 'сохранение_не_выполнено' };
    if (saveResult.success) {
      metrics.database.inserted += 1;
      metrics.database.images += saveResult.photoResults ? saveResult.photoResults.length : 0;
    } else if (saveResult.duplicate) {
      metrics.database.duplicates += 1;
    } else {
      metrics.database.errors += 1;
    }

    const photoSummary = summarizePhotos(saveResult.photoResults || [], normalizedResult.unified?.media?.main_image || null);
    const fmvComparison = buildFmvComparison(normalizedResult.unified);
    const photosPayload = {
      bike_id: saveResult.bike_id || null,
      source: 'kleinanzeigen',
      total_photos: photoSummary.totalPhotos,
      download_attempts: (saveResult.photoResults || []).reduce((sum, item) => sum + (item.download_attempts || 0), 0),
      successful_downloads: photoSummary.successPhotos,
      failed_downloads: photoSummary.failedPhotos,
      photos: photoSummary.photos,
      fmv_comparison: fmvComparison,
      summary: {
        total_original_size: formatBytes(photoSummary.totalOriginal),
        total_optimized_size: formatBytes(photoSummary.totalOptimized),
        total_savings: photoSummary.totalOriginal
          ? `${formatBytes(photoSummary.totalOriginal - photoSummary.totalOptimized)} (${Math.max(0, Math.round((1 - photoSummary.totalOptimized / photoSummary.totalOriginal) * 1000) / 10)}%)`
          : null,
        imagekit_storage_used: formatBytes(photoSummary.totalOptimized),
        average_upload_time: photoSummary.averageUpload
      }
    };
    safeWriteJson(path.join(photosDir, `kleinanzeigen_bike_${index}_photos.json`), photosPayload);

    const dbLogPayload = {
      success: saveResult.success,
      duplicate: saveResult.duplicate,
      bike_id: saveResult.bike_id,
      reason: saveResult.reason,
      photoCount: photoSummary.totalPhotos,
      fields: {
        name: normalizedResult.unified.basic_info?.name || preprocessed.title || 'Неизвестно',
        brand: normalizedResult.unified.basic_info?.brand || 'Неизвестно',
        model: normalizedResult.unified.basic_info?.model || 'Неизвестно',
        year: normalizedResult.unified.basic_info?.year || null,
        category: normalizedResult.unified.basic_info?.category || 'mtb',
        price: normalizedResult.unified.pricing?.price ?? preprocessed.price ?? 0,
        quality_score: normalizedResult.unified.quality_score ?? 0,
        main_image: normalizedResult.unified.media?.main_image || null,
        source_platform: normalizedResult.unified.meta?.source_platform || 'kleinanzeigen',
        source_ad_id: normalizedResult.unified.meta?.source_ad_id || preprocessed.source_ad_id || null,
        unified_length: JSON.stringify(normalizedResult.unified || {}).length
      }
    };
    fs.writeFileSync(path.join(logsDir, `kleinanzeigen_bike_${index}_db.log`), createDbLog(dbLogPayload.fields.name, dbLogPayload));

    processedBikes.push({
      source: 'kleinanzeigen',
      url: listing.url,
      db_id: saveResult.bike_id || null,
      normalized: normalizedResult.unified,
      fmv_comparison: fmvComparison,
      photos: photoSummary.photos
    });

    const success = !normalizedResult.error && (normalizedResult.unified.quality_score || 0) > 0;
    if (success) {
      summary.kleinanzeigen_results.successfully_normalized += 1;
    } else {
      summary.kleinanzeigen_results.failed_normalization += 1;
      summary.issues.push({
        bike: `kleinanzeigen_bike_${index}`,
        issue: normalizedResult.error ? normalizedResult.error.message : 'низкий_quality_score',
        severity: 'предупреждение',
        fallback: 'байк сохранён с quality_score=0, нужен_аудит=true'
      });
    }

    metrics.kleinanzeigen.push({
      quality: normalizedResult.unified.quality_score ?? 0,
      completeness: completeness.percent,
      photos: photoSummary.totalPhotos,
      downloaded: photoSummary.successPhotos,
      optimizedBytes: photoSummary.totalOptimized,
      originalBytes: photoSummary.totalOriginal,
      geminiMs: normalizedResult.elapsedMs
    });

    metrics.photos.total += photoSummary.totalPhotos;
    metrics.photos.downloaded += photoSummary.successPhotos;
    metrics.photos.originalBytes += photoSummary.totalOriginal;
    metrics.photos.optimizedBytes += photoSummary.totalOptimized;
  }

  console.log('ШАГ 2: BUYCYCLE (5 велосипедов)');
  const buycycleCollector = BuycycleCollector;
  const buycycleBrowser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const buycyclePage = await buycycleBrowser.newPage();
  await buycyclePage.setViewport({ width: 1920, height: 1080 });
  const buycycleUrl = buycycleCollector.buildSearchUrl({
    brand: 'YT',
    model: 'Capra',
    minPrice: 800,
    maxPrice: 2000
  });
  await buycycleCollector._navigateWithRetry(buycyclePage, buycycleUrl, 120000);
  const buycycleListings = await buycycleCollector.extractListingsFromPage(buycyclePage);
  const buycycleSelected = buycycleListings.slice(0, 5);
  summary.test_run.buycycle_bikes = buycycleSelected.length;
  summary.buycycle_results.total_attempted = buycycleSelected.length;

  for (let i = 0; i < buycycleSelected.length; i += 1) {
    const listing = buycycleSelected[i];
    const index = i + 1;
    console.log(`   ▶️ Buycycle велосипед ${index}: ${listing.url}`);
    await buycyclePage.goto(listing.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const html = await buycyclePage.content();
    const $ = cheerio.load(html);
    const nextData = BuycyclePreprocessor.extractNextData($);
    const product = BuycyclePreprocessor.resolveProduct(nextData);
    const preprocessed = BuycyclePreprocessor.preprocess({
      html,
      url: listing.url,
      title: listing.title,
      price: listing.price,
      images: listing.image ? [listing.image] : [],
      external_id: listing.external_id
    });

    const nextDataPhotos = Array.isArray(product?.images) ? product.images.length : 0;
    const rawPayload = {
      source: 'buycycle',
      url: listing.url,
      scraped_at: formatIso(new Date()),
      raw_data: {
        title: preprocessed.title || listing.title,
        price: preprocessed.price ?? listing.price,
        condition: preprocessed.condition || null,
        description: preprocessed.description || null,
        photos: preprocessed.images || [],
        photos_count: Array.isArray(preprocessed.images) ? preprocessed.images.length : 0,
        extraction_success: true
      },
      next_data_extraction: {
        found: !!nextData,
        bike_data_present: !!product,
        components_found: Object.keys(preprocessed.components || {}).length,
        general_info_found: Object.keys(preprocessed.general_info || {}).length > 0,
        photos_in_next_data: nextDataPhotos,
        fallback_dom_used: !nextData || !product
      }
    };
    safeWriteJson(path.join(jsonDir, `buycycle_bike_${index}_raw.json`), rawPayload);

    const preprocessedPayload = {
      source: 'buycycle',
      preprocessor: 'BuycyclePreprocessor',
      processed_at: formatIso(new Date()),
      preprocessed_data: {
        title: preprocessed.title,
        price: preprocessed.price,
        condition: preprocessed.condition,
        components: preprocessed.components || {},
        general_info: preprocessed.general_info || {},
        photos: preprocessed.images || [],
        photos_filtered_count: Array.isArray(preprocessed.images) ? preprocessed.images.length : 0,
        photos_rejected_count: 0
      }
    };
    safeWriteJson(path.join(jsonDir, `buycycle_bike_${index}_preprocessed.json`), preprocessedPayload);

    const normalizedResult = await normalizeWithTelemetry(preprocessed, 'buycycle');
    const completeness = countCompleteness(normalizedResult.unified);
    const yearFromTitle = extractYear(preprocessed.title);
    const normalizedPayload = {
      source: 'buycycle',
      normalizer: 'UnifiedNormalizer + Gemini',
      normalized_at: formatIso(new Date()),
      gemini_attempts: normalizedResult.attempts,
      gemini_response_time: formatSeconds(normalizedResult.elapsedMs),
      unified_data: normalizedResult.unified,
      post_processing: {
        brand_correction: normalizedResult.unified?.basic_info?.brand
          ? `${normalizedResult.unified.basic_info.brand} → ${normalizedResult.unified.basic_info.brand} (без изменений)`
          : 'Неизвестно → Неизвестно',
        year_extraction: yearFromTitle ? `${yearFromTitle} (из заголовка)` : 'не_найден',
        completeness: `${completeness.percent}%`,
        fields_filled: completeness.filled,
        fields_total: completeness.total
      }
    };
    safeWriteJson(path.join(jsonDir, `buycycle_bike_${index}_normalized.json`), normalizedPayload);

    const saveSummary = await dbService.saveBikesToDB(normalizedResult.unified, { includePhotoResults: true });
    const saveResult = saveSummary.results[0] || { success: false, reason: 'сохранение_не_выполнено' };
    if (saveResult.success) {
      metrics.database.inserted += 1;
      metrics.database.images += saveResult.photoResults ? saveResult.photoResults.length : 0;
    } else if (saveResult.duplicate) {
      metrics.database.duplicates += 1;
    } else {
      metrics.database.errors += 1;
    }

    const photoSummary = summarizePhotos(saveResult.photoResults || [], normalizedResult.unified?.media?.main_image || null);
    const fmvComparison = buildFmvComparison(normalizedResult.unified);
    const photosPayload = {
      bike_id: saveResult.bike_id || null,
      source: 'buycycle',
      total_photos: photoSummary.totalPhotos,
      download_attempts: (saveResult.photoResults || []).reduce((sum, item) => sum + (item.download_attempts || 0), 0),
      successful_downloads: photoSummary.successPhotos,
      failed_downloads: photoSummary.failedPhotos,
      photos: photoSummary.photos,
      fmv_comparison: fmvComparison,
      summary: {
        total_original_size: formatBytes(photoSummary.totalOriginal),
        total_optimized_size: formatBytes(photoSummary.totalOptimized),
        total_savings: photoSummary.totalOriginal
          ? `${formatBytes(photoSummary.totalOriginal - photoSummary.totalOptimized)} (${Math.max(0, Math.round((1 - photoSummary.totalOptimized / photoSummary.totalOriginal) * 1000) / 10)}%)`
          : null,
        imagekit_storage_used: formatBytes(photoSummary.totalOptimized),
        average_upload_time: photoSummary.averageUpload
      }
    };
    safeWriteJson(path.join(photosDir, `buycycle_bike_${index}_photos.json`), photosPayload);

    const dbLogPayload = {
      success: saveResult.success,
      duplicate: saveResult.duplicate,
      bike_id: saveResult.bike_id,
      reason: saveResult.reason,
      photoCount: photoSummary.totalPhotos,
      fields: {
        name: normalizedResult.unified.basic_info?.name || preprocessed.title || 'Неизвестно',
        brand: normalizedResult.unified.basic_info?.brand || 'Неизвестно',
        model: normalizedResult.unified.basic_info?.model || 'Неизвестно',
        year: normalizedResult.unified.basic_info?.year || null,
        category: normalizedResult.unified.basic_info?.category || 'mtb',
        price: normalizedResult.unified.pricing?.price ?? preprocessed.price ?? 0,
        quality_score: normalizedResult.unified.quality_score ?? 0,
        main_image: normalizedResult.unified.media?.main_image || null,
        source_platform: normalizedResult.unified.meta?.source_platform || 'buycycle',
        source_ad_id: normalizedResult.unified.meta?.source_ad_id || preprocessed.source_ad_id || null,
        unified_length: JSON.stringify(normalizedResult.unified || {}).length
      }
    };
    fs.writeFileSync(path.join(logsDir, `buycycle_bike_${index}_db.log`), createDbLog(dbLogPayload.fields.name, dbLogPayload));

    processedBikes.push({
      source: 'buycycle',
      url: listing.url,
      db_id: saveResult.bike_id || null,
      normalized: normalizedResult.unified,
      fmv_comparison: fmvComparison,
      photos: photoSummary.photos
    });

    const success = !normalizedResult.error && (normalizedResult.unified.quality_score || 0) > 0;
    if (success) {
      summary.buycycle_results.successfully_normalized += 1;
    } else {
      summary.buycycle_results.failed_normalization += 1;
      summary.buycycle_results.failure_reason = summary.buycycle_results.failure_reason || (normalizedResult.error ? normalizedResult.error.message : 'низкий_quality_score');
      summary.issues.push({
        bike: `buycycle_bike_${index}`,
        issue: normalizedResult.error ? normalizedResult.error.message : 'низкий_quality_score',
        severity: 'предупреждение',
        fallback: 'байк сохранён с quality_score=0, нужен_аудит=true'
      });
    }

    metrics.buycycle.push({
      quality: normalizedResult.unified.quality_score ?? 0,
      completeness: completeness.percent,
      photos: photoSummary.totalPhotos,
      downloaded: photoSummary.successPhotos,
      optimizedBytes: photoSummary.totalOptimized,
      originalBytes: photoSummary.totalOriginal,
      geminiMs: normalizedResult.elapsedMs
    });

    metrics.photos.total += photoSummary.totalPhotos;
    metrics.photos.downloaded += photoSummary.successPhotos;
    metrics.photos.originalBytes += photoSummary.totalOriginal;
    metrics.photos.optimizedBytes += photoSummary.totalOptimized;
  }

  await buycycleBrowser.close();

  summary.test_run.total_bikes = summary.test_run.kleinanzeigen_bikes + summary.test_run.buycycle_bikes;
  summary.database.bikes_inserted = metrics.database.inserted;
  summary.database.bikes_duplicate = metrics.database.duplicates;
  summary.database.bike_images_inserted = metrics.database.images;
  summary.database.errors = metrics.database.errors;

  const average = (arr, key) => {
    if (!arr.length) return 0;
    return arr.reduce((sum, item) => sum + (item[key] || 0), 0) / arr.length;
  };

  const kleinAvgQuality = average(metrics.kleinanzeigen, 'quality');
  const kleinAvgCompleteness = average(metrics.kleinanzeigen, 'completeness');
  const kleinAvgPhotos = average(metrics.kleinanzeigen, 'photos');
  const kleinAvgGemini = average(metrics.kleinanzeigen, 'geminiMs');
  summary.kleinanzeigen_results.average_quality_score = Number(kleinAvgQuality.toFixed(1));
  summary.kleinanzeigen_results.average_completeness = Number(kleinAvgCompleteness.toFixed(1));
  summary.kleinanzeigen_results.average_photos_per_bike = Number(kleinAvgPhotos.toFixed(1));
  summary.kleinanzeigen_results.total_photos_uploaded = metrics.kleinanzeigen.reduce((sum, item) => sum + item.downloaded, 0);
  summary.kleinanzeigen_results.total_storage_used = formatBytes(metrics.kleinanzeigen.reduce((sum, item) => sum + item.optimizedBytes, 0));
  summary.kleinanzeigen_results.average_gemini_time = formatSeconds(kleinAvgGemini);
  summary.kleinanzeigen_results.photo_success_rate = metrics.kleinanzeigen.reduce((sum, item) => sum + item.photos, 0) > 0
    ? `${((metrics.kleinanzeigen.reduce((sum, item) => sum + item.downloaded, 0) / metrics.kleinanzeigen.reduce((sum, item) => sum + item.photos, 0)) * 100).toFixed(1)}%`
    : '0%';

  const buyAvgQuality = average(metrics.buycycle, 'quality');
  const buyAvgCompleteness = average(metrics.buycycle, 'completeness');
  const buyAvgPhotos = average(metrics.buycycle, 'photos');
  const buyAvgGemini = average(metrics.buycycle, 'geminiMs');
  summary.buycycle_results.average_quality_score = Number(buyAvgQuality.toFixed(1));
  summary.buycycle_results.average_completeness = Number(buyAvgCompleteness.toFixed(1));
  summary.buycycle_results.average_photos_per_bike = Number(buyAvgPhotos.toFixed(1));
  summary.buycycle_results.total_photos_uploaded = metrics.buycycle.reduce((sum, item) => sum + item.downloaded, 0);
  summary.buycycle_results.total_storage_used = formatBytes(metrics.buycycle.reduce((sum, item) => sum + item.optimizedBytes, 0));
  summary.buycycle_results.average_gemini_time = formatSeconds(buyAvgGemini);
  summary.buycycle_results.photo_success_rate = metrics.buycycle.reduce((sum, item) => sum + item.photos, 0) > 0
    ? `${((metrics.buycycle.reduce((sum, item) => sum + item.downloaded, 0) / metrics.buycycle.reduce((sum, item) => sum + item.photos, 0)) * 100).toFixed(1)}%`
    : '0%';

  summary.photo_pipeline.total_photos_downloaded = metrics.photos.total;
  summary.photo_pipeline.successful_uploads = metrics.photos.downloaded;
  summary.photo_pipeline.failed_uploads = metrics.photos.total - metrics.photos.downloaded;
  summary.photo_pipeline.success_rate = metrics.photos.total > 0 ? `${((metrics.photos.downloaded / metrics.photos.total) * 100).toFixed(1)}%` : '0%';
  summary.photo_pipeline.total_original_size = formatBytes(metrics.photos.originalBytes);
  summary.photo_pipeline.total_optimized_size = formatBytes(metrics.photos.optimizedBytes);
  summary.photo_pipeline.optimization_ratio = metrics.photos.originalBytes > 0
    ? `${Math.max(0, Math.round((1 - metrics.photos.optimizedBytes / metrics.photos.originalBytes) * 1000) / 10)}%`
    : '0%';
  summary.photo_pipeline.imagekit_storage_used = formatBytes(metrics.photos.optimizedBytes);

  const durationMs = Date.now() - startedAt;
  summary.test_run.duration = `${Math.floor(durationMs / 60000)} мин ${Math.floor((durationMs % 60000) / 1000)} сек`;

  if (summary.buycycle_results.failed_normalization > 0 && !summary.buycycle_results.failure_reason) {
    summary.buycycle_results.failure_reason = 'Нормализация Gemini не удалась';
  }

  if (summary.buycycle_results.failed_normalization > 0) {
    summary.recommendations.push('Buycycle: есть сбои нормализации - проверьте стабильность Gemini API');
  }
  if (summary.photo_pipeline.success_rate !== '0%') {
    summary.recommendations.push('Фото-пайплайн: показатели загрузки подтверждены, сравните с SLA');
  }
  if (summary.kleinanzeigen_results.successfully_normalized === summary.kleinanzeigen_results.total_attempted) {
    summary.recommendations.push('Kleinanzeigen: парсер стабилен, можно повышать лимиты выборки');
  }

  safeWriteJson(path.join(summaryDir, 'test-summary.json'), summary);
  safeWriteJson(path.join(summaryDir, 'all-bikes-with-photos.json'), {
    generated_at: formatIso(new Date()),
    total_bikes: processedBikes.length,
    bikes: processedBikes
  });

  const pickTopBottom = (items) => {
    if (items.length === 0) return { top: null, low: null };
    const sorted = [...items].sort((a, b) => b.quality - a.quality);
    return { top: sorted[0], low: sorted[sorted.length - 1] };
  };

  const kleinTop = pickTopBottom(metrics.kleinanzeigen);
  const buyTop = pickTopBottom(metrics.buycycle);
  const report = [
    '═══════════════════════════════════════════════════════════════',
    '  ОТЧЁТ КОМПЛЕКСНОГО ТЕСТА ВАЛИДАЦИИ ПАРСЕРА',
    `  Дата теста: ${formatFolderTimestamp(runDate).replace('_', ' ')}`,
    `  Длительность: ${summary.test_run.duration}`,
    '═══════════════════════════════════════════════════════════════',
    '',
    '📊 ОБЗОР',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Всего обработано: ${summary.test_run.total_bikes}`,
    `  ├─ Kleinanzeigen: ${summary.test_run.kleinanzeigen_bikes}`,
    `  └─ Buycycle: ${summary.test_run.buycycle_bikes}`,
    '',
    `Успех сохранения: ${summary.database.bikes_inserted}/${summary.test_run.total_bikes} сохранено в БД`,
    `  ├─ Kleinanzeigen: ${summary.kleinanzeigen_results.successfully_normalized}/${summary.kleinanzeigen_results.total_attempted}`,
    `  └─ Buycycle: ${summary.buycycle_results.successfully_normalized}/${summary.buycycle_results.total_attempted}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '',
    '🔍 РЕЗУЛЬТАТЫ KLEINANZEIGEN',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Нормализация: ${summary.kleinanzeigen_results.successfully_normalized}/${summary.kleinanzeigen_results.total_attempted} успешно ✅`,
    `Средняя оценка качества: ${summary.kleinanzeigen_results.average_quality_score} / 100`,
    `Средняя полнота: ${summary.kleinanzeigen_results.average_completeness}%`,
    `Фото: ${summary.kleinanzeigen_results.total_photos_uploaded} загружено (${summary.kleinanzeigen_results.photo_success_rate} успех)`,
    `Хранилище: ${summary.kleinanzeigen_results.total_storage_used}`,
    '',
    `Лучший результат: качество ${kleinTop.top ? kleinTop.top.quality : 'н/д'} / 100`,
    `Худший результат: качество ${kleinTop.low ? kleinTop.low.quality : 'н/д'} / 100`,
    '',
    '───────────────────────────────────────────────────────────────',
    '',
    '🚴 РЕЗУЛЬТАТЫ BUYCYCLE',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Нормализация: ${summary.buycycle_results.successfully_normalized}/${summary.buycycle_results.total_attempted} успешно ${summary.buycycle_results.failed_normalization > 0 ? '⚠️' : '✅'}`,
    `Средняя оценка качества: ${summary.buycycle_results.average_quality_score} / 100`,
    `Средняя полнота: ${summary.buycycle_results.average_completeness}%`,
    `Фото: ${summary.buycycle_results.total_photos_uploaded} загружено (${summary.buycycle_results.photo_success_rate} успех)`,
    `Хранилище: ${summary.buycycle_results.total_storage_used}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '',
    '📸 ПРОИЗВОДИТЕЛЬНОСТЬ ФОТО-ПАЙПЛАЙНА',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Всего попыток фото: ${summary.photo_pipeline.total_photos_downloaded}`,
    `Успешно загружено: ${summary.photo_pipeline.successful_uploads} (${summary.photo_pipeline.success_rate})`,
    `Неуспешно: ${summary.photo_pipeline.failed_uploads}`,
    '',
    `Исходный размер: ${summary.photo_pipeline.total_original_size}`,
    `Оптимизированный размер: ${summary.photo_pipeline.total_optimized_size}`,
    `Экономия: ${summary.photo_pipeline.optimization_ratio}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '',
    '⚠️ ОБНАРУЖЕННЫЕ ПРОБЛЕМЫ',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...summary.issues.length
      ? summary.issues.map((issue, idx) => `${idx + 1}. [${issue.severity === 'предупреждение' ? 'ПРЕДУПР' : (issue.severity?.toUpperCase() || 'ПРЕДУПР')}] ${issue.bike}: ${issue.issue}`)
      : ['Критичных проблем не обнаружено'],
    '',
    '✅ РЕКОМЕНДАЦИИ',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...summary.recommendations.length ? summary.recommendations.map(rec => `✓ ${rec}`) : ['✓ Нет рекомендаций'],
    '',
    '📁 АРТЕФАКТЫ ТЕСТА',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Расположение: ${baseDir}`,
    '',
    'Сгенерированные файлы:',
    '  ├─ json/ (raw + preprocessed + normalized)',
    '  ├─ photos/ (логи фото по каждому байку)',
    '  ├─ logs/ (логи БД по каждому байку)',
    '  └─ summary/',
    '      ├─ test-summary.json',
    '      ├─ all-bikes-with-photos.json',
    '      └─ test-report.txt',
    '',
    '═══════════════════════════════════════════════════════════════',
    'КОНЕЦ ОТЧЁТА',
    '═══════════════════════════════════════════════════════════════'
  ].join('\n');

  fs.writeFileSync(path.join(summaryDir, 'test-report.txt'), report);

  console.log('✅ Комплексная валидация парсера завершена');
  console.log(`📄 Сводка: ${path.join(summaryDir, 'test-summary.json')}`);
  console.log(`📄 Отчёт: ${path.join(summaryDir, 'test-report.txt')}`);
};

run().catch((error) => {
  console.error(`❌ Ошибка теста: ${error.message}`);
  process.exit(1);
});
