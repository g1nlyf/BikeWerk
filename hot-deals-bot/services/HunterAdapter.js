/**
 * HunterAdapter - Адаптер для интеграции с HotDealHunter и preprocessors
 * Обрабатывает URL через полный цикл нормализации и сохранения
 */

const path = require('path');

class HunterAdapter {
    constructor() {
        // Пути к бэкенд сервисам
        const backendRoot = path.resolve(__dirname, '../../backend');

        try {
            // Сервисы из src/services
            this.UnifiedNormalizer = require(path.join(backendRoot, 'src/services/UnifiedNormalizer'));
            this.KleinanzeigenPreprocessor = require(path.join(backendRoot, 'src/services/KleinanzeigenPreprocessor'));
            this.BuycyclePreprocessor = require(path.join(backendRoot, 'src/services/BuycyclePreprocessor'));

            // Сервисы из services (без src)
            this.DatabaseService = require(path.join(backendRoot, 'services/database-service-v2'));

            console.log('✅ HunterAdapter: Backend services loaded');
            this.enabled = true;
        } catch (error) {
            console.error('❌ HunterAdapter: Failed to load backend services:', error.message);
            console.error('   Make sure BACKEND_PATH in .env points to correct directory');
            this.enabled = false;
        }
    }

    /**
     * Обработать URL через соответствующий preprocessor и Hunter pipeline
     * @param {string} url 
     * @param {string} source - 'kleinanzeigen', 'buycycle', 'ebay', etc.
     * @returns {Promise<Object>} - { success: boolean, bikeId: string, error: string }
     */
    async processUrl(url, source) {
        if (!this.enabled) {
            throw new Error('HunterAdapter not enabled - backend services not loaded');
        }

        try {
            console.log(`🔥 Processing ${source} URL: ${url}`);

            // 1. Выбираем preprocessor в зависимости от источника
            let rawBike;

            switch (source.toLowerCase()) {
                case 'kleinanzeigen':
                    rawBike = await this.scrapeKleinanzeigen(url);
                    break;
                case 'buycycle':
                    rawBike = await this.scrapeBuycycle(url);
                    break;
                case 'ebay':
                case 'mobile.de':
                case 'autoscout24':
                    // Для этих источников пока используем fallback
                    rawBike = await this.scrapeFallback(url, source);
                    break;
                default:
                    rawBike = await this.scrapeFallback(url, source);
            }

            if (!rawBike || !rawBike.title) {
                throw new Error('Failed to scrape bike data');
            }

            console.log(`   📝 Scraped: ${rawBike.title}`);

            // 2. Нормализация через Gemini AI
            console.log('   🤖 Normalizing with AI...');
            const normalized = await this.UnifiedNormalizer.normalize(rawBike, source);

            if (!normalized || !normalized.basic_info) {
                throw new Error('Normalization failed');
            }

            // 3. Quality Gate
            const qualityScore = normalized.quality_score || 0;
            console.log(`   📊 Quality score: ${qualityScore}`);

            if (qualityScore < 40) {
                throw new Error(`Low quality score: ${qualityScore}`);
            }

            // 4. Пометка как Hot Deal
            this.markAsHotDeal(normalized);

            // 5. Сохранение в базу
            console.log('   💾 Saving to database...');
            const saveResult = await this.DatabaseService.saveBikesToDB([normalized], {
                skipPhotoDownload: false
            });

            if (saveResult.inserted > 0) {
                const bikeId = saveResult.results[0]?.id;
                console.log(`   ✅ Saved successfully! Bike ID: ${bikeId}`);

                return {
                    success: true,
                    bikeId: bikeId,
                    bikeName: normalized.basic_info?.name,
                    price: normalized.pricing?.price,
                    qualityScore: qualityScore
                };
            } else {
                const reason = saveResult.results[0]?.reason || 'Unknown';
                throw new Error(`Save failed: ${reason}`);
            }

        } catch (error) {
            console.error(`   ❌ Error processing URL: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Скрапинг Kleinanzeigen через Puppeteer
     */
    async scrapeKleinanzeigen(url) {
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // Получаем HTML
            const html = await page.content();

            // Обрабатываем через KleinanzeigenPreprocessor
            const preprocessed = this.KleinanzeigenPreprocessor.preprocess({ html, url });

            await browser.close();

            return {
                ...preprocessed,
                url,
                source: 'kleinanzeigen'
            };

        } catch (error) {
            if (browser) await browser.close();
            throw error;
        }
    }

    /**
     * Скрапинг Buycycle
     */
    async scrapeBuycycle(url) {
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            // Используем BuycyclePreprocessor scraping logic
            const details = await page.evaluate(() => {
                const data = {};

                // JSON-LD
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const s of scripts) {
                    try {
                        const json = JSON.parse(s.textContent);
                        const product = Array.isArray(json)
                            ? json.find(i => i['@type'] === 'Product')
                            : (json['@type'] === 'Product' ? json : null);

                        if (product) {
                            data.title = product.name;
                            data.brand = product.brand?.name || product.brand;
                            data.description = product.description;
                            data.images = Array.isArray(product.image) ? product.image : [product.image];

                            if (product.offers) {
                                const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                                data.price = parseFloat(offer.price);
                            }
                        }
                    } catch (e) { }
                }

                // Images fallback
                const imgs = Array.from(document.querySelectorAll('img[src*="/uploads/"], img[src*="cloudfront"]'))
                    .map(img => img.src)
                    .filter(src => src && !src.includes('avatar'));

                data.images = [...new Set([...(data.images || []), ...imgs])];

                return data;
            });

            await browser.close();

            return {
                ...details,
                url,
                source: 'buycycle',
                source_platform: 'buycycle'
            };

        } catch (error) {
            if (browser) await browser.close();
            throw error;
        }
    }

    /**
     * Fallback для других источников (basic scraping)
     */
    async scrapeFallback(url, source) {
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

            const data = await page.evaluate(() => {
                return {
                    title: document.querySelector('h1')?.textContent?.trim() || 'Unknown',
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    images: Array.from(document.querySelectorAll('img')).map(img => img.src).filter(Boolean).slice(0, 5)
                };
            });

            await browser.close();

            return {
                ...data,
                url,
                source,
                source_platform: source
            };

        } catch (error) {
            if (browser) await browser.close();
            throw error;
        }
    }

    /**
     * Пометить байк как Hot Deal
     */
    markAsHotDeal(normalized) {
        normalized.ranking = normalized.ranking || {};
        normalized.ranking.is_hot_offer = true;
        normalized.ranking.ranking_score = Math.max(normalized.ranking.ranking_score || 0.7, 0.85);
        normalized.ranking.hotness_score = 0.95;
        normalized.ranking.priority = 'high';

        normalized.meta = normalized.meta || {};
        normalized.meta.is_manual_submission = true;
        normalized.meta.submitted_via_bot = true;

        normalized.internal = normalized.internal || {};
        normalized.internal.tags = normalized.internal.tags || [];
        normalized.internal.tags.push('hot_deal');
        normalized.internal.tags.push('manual_submission');
        normalized.internal.tags.push('stolen_bike_bot');
    }
}

module.exports = new HunterAdapter();
