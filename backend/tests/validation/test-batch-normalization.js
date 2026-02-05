const BuycycleCollector = require('../../scrapers/buycycle-collector');
const KleinanzeigenCollector = require('../../src/scrapers/kleinanzeigen-collector');
const UnifiedNormalizer = require('../../src/services/UnifiedNormalizer');

const getArgValue = (name, fallback) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  const value = parseInt(process.argv[idx + 1], 10);
  return Number.isFinite(value) ? value : fallback;
};

const isBuycycle = (item) => item && (item.source_platform === 'buycycle' || item.source === 'buycycle');
const isKleinanzeigen = (item) => item && (item.source_platform === 'kleinanzeigen' || item.source === 'kleinanzeigen');

const run = async () => {
  const limit = getArgValue('--limit', 10);
  const perSource = Math.floor(limit / 2);

  console.log(`🧪 BATCH NORMALIZATION TEST (${limit} bikes)`);
  console.log('');
  console.log(`Sources: Buycycle (${perSource}), Kleinanzeigen (${perSource})`);
  console.log('');
  console.log('PROCESSING...');

  const buycycleItems = await BuycycleCollector.collectForTarget({
    brand: 'YT',
    model: 'Capra',
    limit: perSource
  });

  const kleinanzeigenItems = await KleinanzeigenCollector.searchBikes('Canyon Spectral', { limit: perSource });

  const all = [
    ...buycycleItems.map((item) => ({ ...item, source_platform: 'buycycle' })),
    ...kleinanzeigenItems.map((item) => ({ ...item, source_platform: 'kleinanzeigen' }))
  ].slice(0, limit);

  let processed = 0;
  let success = 0;
  let failed = 0;
  let duplicates = 0;
  let buycycleCompleteness = 0;
  let kleinCompleteness = 0;
  let buycycleQuality = 0;
  let kleinQuality = 0;
  let buycycleCount = 0;
  let kleinCount = 0;

  for (const item of all) {
    processed += 1;
    const source = isBuycycle(item) ? 'Buycycle' : 'Kleinanzeigen';
    const name = item.title || item.name || `${item.brand || ''} ${item.model || ''}`.trim() || 'Unknown';

    let normalized;
    if (item.basic_info && item.meta) {
        // Already normalized (e.g. from BuycycleCollector)
        normalized = item;
    } else {
        // Raw item (e.g. from KleinanzeigenCollector)
        normalized = await UnifiedNormalizer.normalize(item, item.source_platform);
    }

    const completeness = normalized.meta?.completeness_score ?? 0;
    const quality = normalized.quality_score ?? 0;
    const pass = quality >= 40;

    if (normalized.audit?.audit_status === 'duplicate') duplicates += 1;
    if (pass) success += 1;
    else failed += 1;

    if (source === 'Buycycle') {
      buycycleCompleteness += completeness;
      buycycleQuality += quality;
      buycycleCount += 1;
    } else {
      kleinCompleteness += completeness;
      kleinQuality += quality;
      kleinCount += 1;
    }

    console.log(`[${processed}/${limit}] ${source}: ${name} ${pass ? '✅' : '⚠️'} (completeness: ${completeness}%, quality: ${quality}${pass ? '' : ' - REJECTED'})${normalized.audit?.audit_status === 'duplicate' ? ' [DUPLICATE]' : ''}`);
  }

  const buycycleAvgCompleteness = buycycleCount ? (buycycleCompleteness / buycycleCount).toFixed(1) : '0.0';
  const kleinAvgCompleteness = kleinCount ? (kleinCompleteness / kleinCount).toFixed(1) : '0.0';
  const overallAvgCompleteness = ((buycycleCompleteness + kleinCompleteness) / Math.max(1, buycycleCount + kleinCount)).toFixed(1);

  const buycycleAvgQuality = buycycleCount ? Math.round(buycycleQuality / buycycleCount) : 0;
  const kleinAvgQuality = kleinCount ? Math.round(kleinQuality / kleinCount) : 0;
  const overallAvgQuality = Math.round((buycycleQuality + kleinQuality) / Math.max(1, buycycleCount + kleinCount));

  const passRate = Math.round((success / Math.max(1, processed)) * 100);

  console.log('');
  console.log('════════');
  console.log('BATCH NORMALIZATION SUMMARY');
  console.log('════════');
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully normalized: ${success} (${passRate}%)`);
  console.log(`Failed/Rejected: ${failed}`);
  console.log('');
  console.log('Average completeness:');
  console.log(`  - Buycycle: ${buycycleAvgCompleteness}%`);
  console.log(`  - Kleinanzeigen: ${kleinAvgCompleteness}%`);
  console.log(`  - Overall: ${overallAvgCompleteness}%`);
  console.log('');
  console.log('Average quality score:');
  console.log(`  - Buycycle: ${buycycleAvgQuality}`);
  console.log(`  - Kleinanzeigen: ${kleinAvgQuality}`);
  console.log(`  - Overall: ${overallAvgQuality}`);
  console.log('');
  console.log(`Duplicates detected: ${duplicates}`);
  console.log('');
  console.log(`Pass rate: ${passRate}% ${passRate >= 85 ? '✅' : '❌'}`);
};

run().catch((e) => {
  console.log(`❌ Ошибка: ${e.message}`);
  process.exit(1);
});
