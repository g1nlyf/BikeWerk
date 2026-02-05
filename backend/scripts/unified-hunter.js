
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CatalogGapAnalyzer = require('../src/services/catalog-gap-analyzer.js');
const BuycycleCollector = require('../scrapers/buycycle-collector.js');
const KleinanzeigenCollector = require('../src/scrapers/kleinanzeigen-collector.js');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer.js');
const DatabaseService = require('../src/services/DatabaseService.js');
const SmartModelSelector = require('../src/services/SmartModelSelector.js');
const { DatabaseManager } = require('../src/js/mysql-config');
const brandsConfig = require('../config/brands-config.json');

function formatTimestamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function createLogger(scope) {
    return (message) => console.log(`[${formatTimestamp()}] [${scope}] ${message}`);
}

function createEventLogger(scope) {
    return (event, payload = {}) => {
        const entry = { timestamp: formatTimestamp(), scope, event, ...payload };
        console.log(JSON.stringify(entry));
    };
}

const log = createLogger('UnifiedHunter');
const logEvent = createEventLogger('UnifiedHunter');
const logNormalizer = createLogger('UnifiedNormalizer');
const logBuycycle = createLogger('BuycycleCollector');
const logKleinanzeigen = createLogger('KleinanzeigenCollector');

async function normalizeWithRetry(rawBike, source, options = {}) {
    const retries = options.retries ?? 3;
    const delayMs = options.delayMs ?? 1500;
    const timeoutMs = options.timeoutMs ?? null;
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            const normalizePromise = UnifiedNormalizer.normalize(rawBike, source, options);
            if (!timeoutMs) {
                return await normalizePromise;
            }
            const result = await Promise.race([
                normalizePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
            ]);
            return result;
        } catch (e) {
            lastError = e;
            const msg = String(e?.message || e);
            const is503 = msg.includes('503') || msg.toLowerCase().includes('service unavailable');
            if (!is503 || attempt === retries) break;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw lastError;
}

function resolveSources(requestedSources, gaps, filters) {
    const normalized = (requestedSources || []).map((s) => s.toLowerCase());
    if (normalized.includes('both')) return ['buycycle', 'kleinanzeigen'];
    if (normalized.length > 0) return normalized;
    const sources = ['buycycle'];
    if (filters.maxPrice < 1200 || gaps?.priority === 'URGENT') {
        sources.push('kleinanzeigen');
    }
    return sources;
}

function buildTargets(mode) {
    const tiers = mode === 'full' ? [brandsConfig.tier1, brandsConfig.tier2] : [brandsConfig.tier1];
    const maxTargets = mode === 'test' ? 1 : mode === 'full' ? 12 : 6;
    const maxModels = mode === 'full' ? 2 : 1;
    const targets = [];
    for (const tier of tiers) {
        for (const brand of tier) {
            for (const model of (brand.models || []).slice(0, maxModels)) {
                targets.push({ brand: brand.name, model });
                if (targets.length >= maxTargets) return targets;
            }
        }
    }
    return targets;
}

function buildFiltersFromGaps(gaps) {
    const filters = {};
    if (gaps.gaps.sizes.length > 0) {
        filters.sizes = gaps.gaps.sizes
            .sort((a, b) => b.deficit - a.deficit)
            .slice(0, 3)
            .map((g) => g.size.toLowerCase());
    }
    if (gaps.gaps.prices.length > 0) {
        const topPriceGap = gaps.gaps.prices.sort((a, b) => b.deficit - a.deficit)[0];
        const range = topPriceGap.priceRange.match(/€(\d+)-(\d+)/);
        if (range) {
            filters.minPrice = parseInt(range[1]);
            filters.maxPrice = parseInt(range[2]);
        } else {
            const range2 = topPriceGap.priceRange.match(/(\d+)-(\d+)/);
            if (range2) {
                filters.minPrice = parseInt(range2[1]);
                filters.maxPrice = parseInt(range2[2]);
            }
        }
    }
    if (gaps.gaps.freshness.needFreshBikes) {
        filters.minYear = gaps.gaps.freshness.minYear;
        filters.maxYear = new Date().getFullYear();
    }
    return filters;
}

async function collectFromKleinanzeigen(target, filters, limit, logCollector) {
    const term = `${target.brand} ${target.model}`;
    const rawItems = await KleinanzeigenCollector.searchBikes(term, {
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        limit
    });
    logKleinanzeigen(`Найдено объявлений: ${rawItems.length}`);
    const normalized = [];
    let failed = 0;
    for (const item of rawItems) {
        let rawBike;
        try {
            // DEEP SCRAPE
            logCollector(`🔍 Deep Scraping: ${item.url}`);
            const richData = await KleinanzeigenCollector.scrapeListing(item.url);

            if (!richData) {
                logCollector(`⚠️ Scraping failed for ${item.url}, skipping.`);
                continue;
            }

            rawBike = {
                title: richData.title,
                price: richData.price,
                description: richData.description,
                url: richData.url,
                image: richData.gallery[0] || item.image,
                gallery: richData.gallery,
                attributes: richData.attributes,
                brand: target.brand,
                model: target.model,
                source: 'kleinanzeigen',
                external_id: item.external_id || item.id
            };
        } catch (scrapeErr) {
            logCollector(`❌ Deep Scrape Error: ${scrapeErr.message}`);
            continue;
        }

        try {
            logCollector(`Нормализация Kleinanzeigen: ${rawBike.title}`);
            const unified = await normalizeWithRetry(rawBike, 'kleinanzeigen', { useGemini: true, timeoutMs: 45000 });
            normalized.push(unified);
            const name = unified?.basic_info?.name || `${unified?.basic_info?.brand || target.brand} ${unified?.basic_info?.model || target.model}`.trim();
            const quality = unified?.quality_score ?? 'n/a';
            logNormalizer(`Нормализовано: ${name} (quality: ${quality})`);
        } catch (e) {
            failed += 1;
            logCollector(`Ошибка нормализации Kleinanzeigen: ${e.message}`);
        }
    }
    return { normalized, failed, scraped: rawItems.length };
}

async function collectFromBuycycle(target, filters, limit, logCollector) {
    const raw = await BuycycleCollector.collectForTarget({ ...target, limit, ...filters });
    logBuycycle(`Найдено кандидатов: ${raw.length}`);
    const normalized = [];
    let failed = 0;
    for (const item of raw) {
        if (item?.basic_info && item?.meta) {
            normalized.push(item);
            const name = item?.basic_info?.name || `${item?.basic_info?.brand || target.brand} ${item?.basic_info?.model || target.model}`.trim();
            const quality = item?.quality_score ?? 'n/a';
            logNormalizer(`Нормализовано: ${name} (quality: ${quality})`);
            continue;
        }
        try {
            logCollector(`Нормализация Buycycle: ${item.title || item.basic_info?.name || 'listing'}`);
            const unified = await normalizeWithRetry(item, 'buycycle', { useGemini: true, timeoutMs: 45000 });
            normalized.push(unified);
            const name = unified?.basic_info?.name || `${unified?.basic_info?.brand || target.brand} ${unified?.basic_info?.model || target.model}`.trim();
            const quality = unified?.quality_score ?? 'n/a';
            logNormalizer(`Нормализовано: ${name} (quality: ${quality})`);
        } catch (e) {
            failed += 1;
            logCollector(`Ошибка нормализации Buycycle: ${e.message}`);
        }
    }
    return { normalized, failed, scraped: raw.length };
}

function printSummary(summary) {
    console.log('═══════════════════════════════════════');
    console.log('UNIFIED HUNTER SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Источники: ${summary.sourcesUsed.join(', ') || 'нет'}`);
    console.log(`Собрано: ${summary.totalScraped}`);
    console.log(`Нормализовано: ${summary.normalized} (${summary.totalScraped > 0 ? Math.round((summary.normalized / summary.totalScraped) * 100) : 0}%)`);
    console.log(`Ошибки нормализации: ${summary.failedNormalization}`);
    console.log(`Фото скачано: ${summary.photosDownloaded}/${summary.photosTotal}`);
    console.log(`Вставки в БД: ${summary.inserts}`);
    console.log(`Ошибки сохранения: ${summary.failedSaves}`);
    console.log(`Дубликаты: ${summary.duplicates}`);
    console.log(`Время: ${summary.elapsed}`);
    console.log('═══════════════════════════════════════');
    console.log('СВОДКА:');
    console.log(`- Объявления собраны: ${summary.totalScraped}`);
    console.log(`- Успешно сохранено: ${summary.inserts}`);
    console.log(`- Фото скачано: ${summary.photosDownloaded}/${summary.photosTotal}`);
}

class UnifiedHunter {
    constructor(options = {}) {
        this.options = options;
    }

    async run() {
        const options = this.options;
        const mode = options.mode || 'gap';
        const limit = options.limit ?? (mode === 'full' ? 100 : mode === 'test' ? 5 : 20);
        const maxTargets = options.targets && options.targets.length > 0 ? options.targets.length : (mode === 'test' ? 1 : mode === 'full' ? 12 : 6);
        const start = Date.now();
        const dbService = new DatabaseService({ logger: createLogger('DatabaseService') });
        const dbManager = new DatabaseManager();

        let targets;
        if (options.targets && options.targets.length > 0) {
            targets = options.targets;
        } else {
            // Initialize database before using SmartModelSelector
            await dbManager.initialize();

            // Используем SmartModelSelector для выбора целей на основе дефицита
            const selector = new SmartModelSelector(CatalogGapAnalyzer, dbManager);
            targets = await selector.selectModelsForHunting(maxTargets);
        }
        const summary = {
            sourcesUsed: [],
            totalScraped: 0,
            normalized: 0,
            failedNormalization: 0,
            failedSaves: 0,
            photosDownloaded: 0,
            photosTotal: 0,
            inserts: 0,
            duplicates: 0
        };
        const collected = [];
        const sourceLabel = options.sources && options.sources.length > 0 ? options.sources.join(', ') : 'auto';
        log(`Старт режима ${mode} (лимит: ${limit}, источник: ${sourceLabel})`);
        logEvent('hunt_start', { mode, limit, targets: targets.length });

        for (const target of targets) {
            const targetCollected = []; // Local batch for this target
            log(`Старт: ${target.brand} ${target.model}`);
            logEvent('target_start', { brand: target.brand, model: target.model });

            // Используем SmartModelSelector для построения фильтров на основе gaps
            const selector = new SmartModelSelector(CatalogGapAnalyzer, dbService);
            const filters = selector.buildFiltersFromGaps(target);

            log(`Фильтры: minPrice=${filters.minPrice}, maxPrice=${filters.maxPrice}, sizes=${filters.targetSizes?.join(', ') || 'all'}`);

            const sources = resolveSources(options.sources, target.gaps, filters);
            summary.sourcesUsed = Array.from(new Set([...summary.sourcesUsed, ...sources]));
            const collectorLog = createLogger(`${target.brand} ${target.model}`);
            logEvent('collector_start', { brand: target.brand, model: target.model, sources, filters, limit });

            let runKleinanzeigen = sources.includes('kleinanzeigen');

            if (sources.includes('buycycle')) {
                try {
                    const result = await collectFromBuycycle(target, filters, limit, collectorLog);
                    summary.totalScraped += result.scraped;
                    summary.normalized += result.normalized.length;
                    summary.failedNormalization += result.failed;
                    targetCollected.push(...result.normalized);
                    logEvent('collector_done', { source: 'buycycle', brand: target.brand, model: target.model, scraped: result.scraped, normalized: result.normalized.length, failed: result.failed });

                    // Fallback: If Buycycle yields 0 results, try Kleinanzeigen
                    if (result.scraped === 0 && !runKleinanzeigen) {
                        collectorLog(`⚠️ Buycycle returned 0 results. Activating Kleinanzeigen fallback...`);
                        runKleinanzeigen = true;
                    }
                } catch (e) {
                    summary.failedNormalization += 1;
                    collectorLog(`❌ Buycycle Critical Failure: ${e.message}. Activating Kleinanzeigen fallback...`);
                    logEvent('collector_error', { source: 'buycycle', brand: target.brand, model: target.model, error: e.message });
                    runKleinanzeigen = true; // Fallback
                }
            }

            if (runKleinanzeigen) {
                try {
                    const result = await collectFromKleinanzeigen(target, filters, Math.min(limit, 10), collectorLog);
                    summary.totalScraped += result.scraped;
                    summary.normalized += result.normalized.length;
                    summary.failedNormalization += result.failed;
                    targetCollected.push(...result.normalized);
                    logEvent('collector_done', { source: 'kleinanzeigen', brand: target.brand, model: target.model, scraped: result.scraped, normalized: result.normalized.length, failed: result.failed });
                } catch (e) {
                    summary.failedNormalization += 1;
                    collectorLog(`Ошибка Kleinanzeigen: ${e.message}`);
                    logEvent('collector_error', { source: 'kleinanzeigen', brand: target.brand, model: target.model, error: e.message });
                }
            }

            if (targetCollected.length > 0) {
                const saveSummary = await dbService.saveBikesToDB(targetCollected);
                summary.inserts += saveSummary.inserted;
                summary.duplicates += saveSummary.duplicates;
                summary.failedSaves += saveSummary.failed;
                summary.photosDownloaded += saveSummary.photosDownloaded;
                summary.photosTotal += saveSummary.photosTotal;
                logEvent('db_save', { inserted: saveSummary.inserted, duplicates: saveSummary.duplicates, failed: saveSummary.failed, photosDownloaded: saveSummary.photosDownloaded, photosTotal: saveSummary.photosTotal });

                // Add to global collection for return
                collected.push(...targetCollected);
            }
        }

        summary.elapsed = `${Math.floor((Date.now() - start) / 60000)}m ${Math.floor(((Date.now() - start) % 60000) / 1000)}s`;
        printSummary(summary);
        logEvent('hunt_end', summary);
        return { summary, bikes: options.returnBikes ? collected : [] };
    }
}

async function run(options = {}) {
    return new UnifiedHunter(options).run();
}

async function smartHunt(brand, model) {
    const result = await run({
        mode: 'gap',
        fillGaps: true,
        sources: ['both'],
        targets: [{ brand, model }],
        limit: 10,
        returnBikes: true
    });
    return result.bikes;
}

module.exports = { run, smartHunt };

if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    const targets = [];
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const [key, inlineValue] = arg.split('=');
            const value = inlineValue !== undefined ? inlineValue : args[i + 1];
            if (key === '--mode') {
                options.mode = value;
                if (inlineValue === undefined) i += 1;
            } else if (key === '--source') {
                options.sources = [value];
                if (inlineValue === undefined) i += 1;
            } else if (key === '--limit') {
                options.limit = Number(value);
                if (inlineValue === undefined) i += 1;
            } else if (key === '--fillGaps') {
                options.fillGaps = true;
            } else if (key === '--returnBikes') {
                options.returnBikes = true;
            }
        } else {
            targets.push(arg);
        }
        i += 1;
    }
    if (targets.length >= 2) {
        if (Object.keys(options).length === 0) {
            smartHunt(targets[0], targets[1]).catch(console.error);
        } else {
            run({ ...options, targets: [{ brand: targets[0], model: targets[1] }] }).catch(console.error);
        }
    } else {
        run(options).catch(console.error);
    }
}

module.exports = UnifiedHunter;
