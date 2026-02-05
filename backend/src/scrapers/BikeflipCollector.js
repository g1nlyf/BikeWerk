const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class BikeflipCollector {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    /**
     * Инициализация браузера
     */
    async init() {
        this.browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });
    }

    /**
     * Сбор listings с BikeFlip
     * @param {string} url - полный URL поиска
     * @param {number} limit - сколько собрать (default: 20)
     * @returns {Array} listings
     */
    async collectFromUrl(url, limit = 20) {
        if (!this.page) await this.init();

        console.log(`   🔍 [BIKEFLIP] Opening: ${url}`);
        
        try {
            await this.page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Ждём загрузки
            await this.page.waitForSelector('body');
            
            // Пробуем найти карточки по более общему селектору или по ссылке
            try {
                await this.page.waitForSelector('a[href^="/de/bikes/"]', { timeout: 5000 });
            } catch (e) {
                console.log(`   ⚠️ Specific selector not found, trying generic parsing...`);
            }

            // Парсим карточки (Robust strategy)
            const listings = await this.page.evaluate((limit) => {
                const results = [];
                // Стратегия 1: По известному классу (если есть)
                const cardsV1 = document.querySelectorAll('.Productcard_wrapper__wGdAv');
                if (cardsV1.length > 0) {
                    cardsV1.forEach(card => {
                        if (results.length >= limit) return;
                        const titleEl = card.querySelector('.Productcard_heading__DwPI3');
                        const priceEl = card.querySelector('.ProductPrice_price__XuIou');
                        const linkEl = card.querySelector('a[href^="/de/bikes/"]');
                        
                        if (titleEl && priceEl && linkEl) {
                            results.push({
                                title: titleEl.textContent.trim(),
                                priceRaw: priceEl.textContent.trim(),
                                urlPartial: linkEl.getAttribute('href')
                            });
                        }
                    });
                }

                // Стратегия 2: По ссылкам (если класс изменился)
                if (results.length === 0) {
                    const links = document.querySelectorAll('a[href^="/de/bikes/"]');
                    links.forEach(link => {
                        if (results.length >= limit) return;
                        // Ищем контейнер (article или div)
                        const container = link.closest('article') || link.closest('div[class*="Product"]');
                        if (container) {
                            const title = container.innerText.split('\n')[0]; // Эвристика
                            const priceMatch = container.innerText.match(/(\d[\d\.]*)\s*€/);
                            
                            if (title && priceMatch) {
                                results.push({
                                    title: title,
                                    priceRaw: priceMatch[0],
                                    urlPartial: link.getAttribute('href')
                                });
                            }
                        }
                    });
                }

                return results.map(item => {
                    const price = parseFloat(item.priceRaw.replace(/[^\d]/g, ''));
                    const adId = item.urlPartial.split('/').pop();
                    return {
                        title: item.title,
                        price: price,
                        url: `https://www.bikeflip.com${item.urlPartial}`,
                        ad_id: adId,
                        source_platform: 'bikeflip'
                    };
                });
            }, limit);

            console.log(`   ✅ [BIKEFLIP] Found ${listings.length} listings`);

            return listings.filter(item => item.price > 0); // Фильтруем без цены

        } catch (e) {
            console.error(`   ❌ [BIKEFLIP] Error: ${e.message}`);
            return [];
        }
    }

    /**
     * Закрытие браузера
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

module.exports = new BikeflipCollector();