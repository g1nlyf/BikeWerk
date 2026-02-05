const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');

const DEFAULT_PROXY_URL = 'http://user258350:otuspk@191.101.73.161:8984';

class KleinanzeigenParser {
    constructor() {
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://thingproxy.freeboard.io/fetch/',
            'https://api.codetabs.com/v1/proxy?quest='
        ];
        
        this.timeout = 5000; // 5 секунд
        this.retryAttempts = 2;

        this.proxyUrl =
            process.env.EUBIKE_PROXY_URL ||
            process.env.HTTPS_PROXY ||
            process.env.HTTP_PROXY ||
            process.env.PROXY_URL ||
            DEFAULT_PROXY_URL;
        this.proxyAgent = this.proxyUrl ? new HttpsProxyAgent(this.proxyUrl) : undefined;
    }

    async parseKleinanzeigenLink(url) {
        console.log(`🔍 Начинаю парсинг ссылки: ${url}`);
        
        try {
            // Валидация URL
            if (!this.isValidKleinanzeigenUrl(url)) {
                throw new Error('Неверная ссылка на Kleinanzeigen');
            }

            // Получаем HTML контент
            const htmlContent = await this.fetchHtmlContent(url);
            
            // Парсим HTML и извлекаем данные
            const bikeData = this.extractBikeData(htmlContent, url);
            
            console.log('✅ Данные успешно извлечены:', bikeData);
            return bikeData;
            
        } catch (error) {
            console.error('❌ Ошибка при парсинге:', error.message);
            throw error;
        }
    }

    isValidKleinanzeigenUrl(url) {
        const kleinanzeigenPattern = /^https?:\/\/(www\.)?kleinanzeigen\.de\/s-anzeige\/.+/;
        return kleinanzeigenPattern.test(url);
    }

    async fetchHtmlContent(url) {
        let lastError;
        
        // Сначала пробуем прямой запрос без прокси (в Node CORS не мешает)
        try {
            console.log(`🌐 Прямой запрос без прокси`);
            const directResp = await fetch(url, {
                timeout: this.timeout,
                agent: this.proxyAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': 'https://www.kleinanzeigen.de/'
                }
            });
            if (directResp.ok) {
                const directHtml = await directResp.text();
                if (directHtml && directHtml.length > 1000) {
                    console.log('✅ HTML контент успешно получен напрямую');
                    return directHtml;
                }
            } else {
                lastError = new Error(`Direct HTTP ${directResp.status}: ${directResp.statusText}`);
            }
        } catch (e) {
            lastError = e;
            console.log(`❌ Ошибка прямого запроса: ${e.message}`);
        }
        
        // Пробуем разные CORS прокси
        for (const proxy of this.corsProxies) {
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    console.log(`🌐 Попытка ${attempt}/${this.retryAttempts} с прокси: ${proxy}`);
                    
                    const proxyUrl = proxy + encodeURIComponent(url);
                    const response = await fetch(proxyUrl, {
                        timeout: this.timeout,
                        agent: this.proxyAgent,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    let content = await response.text();
                    
                    // Для некоторых прокси нужно извлечь содержимое из JSON
                    if (proxy.includes('allorigins')) {
                        const jsonData = JSON.parse(content);
                        content = jsonData.contents;
                    }

                    if (content && content.length > 1000) {
                        console.log('✅ HTML контент успешно получен');
                        return content;
                    } else {
                        throw new Error('Получен пустой или слишком короткий контент');
                    }

                } catch (error) {
                    lastError = error;
                    console.log(`❌ Ошибка с прокси ${proxy}, попытка ${attempt}: ${error.message}`);
                    
                    if (attempt < this.retryAttempts) {
                        await this.delay(1000 * attempt); // Увеличиваем задержку с каждой попыткой
                    }
                }
            }
        }

        throw new Error(`Не удалось получить HTML контент после всех попыток. Последняя ошибка: ${lastError?.message}`);
    }

    extractBikeData(html, originalUrl) {
        const $ = cheerio.load(html);
        
        // Удаляем блок рекомендаций, чтобы он не мешал парсингу
        $('.recommendations, .similar-ads, .related-ads, [class*="recommendation"], [class*="similar"], [class*="related"]').remove();
        $('section:contains("Das könnte dich auch interessieren")').remove();
        $('div:contains("Das könnte dich auch interessieren")').remove();
        
        // Извлекаем основную информацию
        const title = this.extractTitle($);
        const price = this.extractPrice($);
        const originalPrice = this.extractOriginalPrice($);
        const images = this.extractImages($);
        const description = this.extractDescription($);
        const location = this.extractLocation($);
        const condition = this.extractCondition($);
        const specs = this.extractSpecs($);
        const attributes = this.extractAttributes($);
        const seller = this.extractSeller($);
        const sourceAdId = this.extractSourceAdId($);
        const deliveryOption = this.extractDeliveryOption($, description);
        const isNegotiable = this.checkIfNegotiable($);
        
        // Sprint 1.4: Hotness Radar Data
        const views = this.extractViews($);
        const publishDate = this.extractPublishDate($);

        // Парсим заголовок для получения бренда и модели
        const { brand, model, category } = this.parseTitleForBikeInfo(title);
        
        // Получаем очищенный HTML для передачи в Gemini
        const cleanedHtml = this.getCleanedHtmlForGemini($);
        
        return {
            title,
            brand,
            model,
            category,
            price,
            originalPrice, // Заполнено из парсера или будет обновлено если есть скидка
            images,
            description,
            attributes, // Добавляем извлеченные атрибуты
            location,
            condition,
            frameSize: specs.frameSize,
            wheelDiameter: specs.wheelDiameter,
            year: specs.year,
            isNegotiable,
            deliveryOption,
            originalUrl,
            source: 'kleinanzeigen',
            rawHtmlContent: cleanedHtml,
            sellerName: seller.name || null,
            sellerMemberSince: seller.memberSince || null,
            sellerBadges: seller.badges || null,
            sellerType: seller.type || null,
            sourceAdId: sourceAdId || null,
            views,
            publishDate
        };
    }

    extractViews($) {
        // Selector for view count
        const viewsText = $('#viewad-cntr-num').text().trim() || 
                          $('.view-count').text().trim();
        return parseInt(viewsText) || 0;
    }

    extractPublishDate($) {
        // Selector for publish date
        // Usually in .attributelist--key:contains("Erstellungsdatum") + .attributelist--value
        // Format: 07.01.2025
        let dateStr = '';
        
        // Strategy 1: Attribute List
        $('.attributelist--key').each((i, el) => {
            if ($(el).text().includes('Erstellungsdatum')) {
                dateStr = $(el).next('.attributelist--value').text().trim();
            }
        });

        // Strategy 2: Right sidebar details
        if (!dateStr) {
            dateStr = $('#viewad-details .attributelist--value').last().text().trim();
        }

        if (dateStr) {
            // Parse DD.MM.YYYY
            const parts = dateStr.split('.');
            if (parts.length === 3) {
                // Create Date object (Month is 0-indexed)
                return new Date(parts[2], parts[1] - 1, parts[0]).toISOString();
            }
        }

        // Fallback: Today (if newly listed and parsing failed)
        return new Date().toISOString();
    }

    extractTitle($) {
        return $('.boxedarticle--title').text().trim() || 
               $('h1').first().text().trim() || 
               $('title').text().trim() || 
               'Велосипед';
    }

    extractPrice($) {
        const priceText = $('.boxedarticle--price').text().trim() || 
                         $('.price-element').text().trim() ||
                         $('.ad-price').text().trim();
        return this.parsePriceString(priceText);
    }

    extractOriginalPrice($) {
        // Попытка найти зачеркнутую цену или старую цену
        // Обычно это находится рядом с ценой, но может быть в специфических классах
        const selectors = [
            '.struck-price',
            '.old-price', 
            '.uvp-price',
            's',
            'del',
            '.is-struck',
            '[style*="line-through"]',
            '.boxedarticle--price--strike-through'
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length) {
                const text = element.text().trim();
                const price = this.parsePriceString(text);
                if (price > 0) return price;
            }
        }
        
        return null;
    }

    parsePrice(text) {
        return this.parsePriceString(text);
    }

    parsePriceString(text) {
        const clean = text
            .replace(/[^0-9.,]/g, '')
            .replace(/\s+/g, '')
            .trim();
        if (!clean) return 0;
        if (/\d+\.\d{3}/.test(clean)) {
            const normalized = clean.replace(/\./g, '').replace(/,/g, '.');
            return Math.round(parseFloat(normalized));
        }
        const normalized = clean.replace(/,/g, '.');
        return Math.round(parseFloat(normalized) || 0);
    }

    extractImages($) {
        const images = [];
        const seenUrls = new Set();
        const normalizeForDedup = (url) => {
            if (!url) return null;
            try {
                const u = new URL(url);
                u.hash = '';
                u.search = '';
                return u.toString().toLowerCase();
            } catch (_) {
                return String(url).split('?')[0].toLowerCase();
            }
        };
        const toFullUrl = (src) => (src && src.startsWith('http') ? src : `https://www.kleinanzeigen.de${src}`);
        const addImage = (src) => {
            if (!src || !this.isValidImageUrl(src)) return;
            const fullUrl = toFullUrl(src);
            const key = normalizeForDedup(fullUrl);
            if (!key || seenUrls.has(key)) return;
            seenUrls.add(key);
            images.push(fullUrl);
        };
        
        // Priority 1: Search for data-imgsrc (often contains high-res)
        $('[data-imgsrc]').each((i, elem) => {
            const src = $(elem).attr('data-imgsrc');
            addImage(src);
        });

        // Priority 2: JSON-LD or Script data
        // Try to find the gallery JSON structure often present in Kleinanzeigen
        $('script').each((i, elem) => {
            const html = $(elem).html();
            if (html && (html.includes('data-imgsrc') || html.includes('"large"'))) {
                // Simple regex to find URLs in JSON-like structures
                const matches = html.match(/"(https?:\\\/\\\/[^"]+\.(jpg|jpeg|png|webp))"/gi);
                if (matches) {
                    matches.forEach(m => {
                        // Remove quotes and fix escaped slashes
                        const cleanUrl = m.replace(/"/g, '').replace(/\\/g, '');
                        addImage(cleanUrl);
                    });
                }
            }
        });

        // Priority 3: Standard selectors
        const imageSelectors = [
            '#viewad-image img',
            '.galleryimage-element img',
            '.gallery-image img', 
            '.ad-image img',
            '.imagegallery img',
            '.image-gallery img',
            '.carousel-item img',
            '.slider-item img',
            '.thumbnail img',
            '.picture img',
            '.photo img'
        ];
        
        // Проходим по всем селекторам
        imageSelectors.forEach(selector => {
            $(selector).each((i, elem) => {
                const src = $(elem).attr('src') || 
                           $(elem).attr('data-src') || 
                           $(elem).attr('data-original') ||
                           $(elem).attr('data-lazy');
                           
                addImage(src);
            });
        });

        console.log(`🖼️ Найдено ${images.length} изображений`);
        return images;
    }

    isValidImageUrl(url) {
        if (!url) return false;
        
        // Исключаем нежелательные изображения
        const excludePatterns = [
            'placeholder',
            'loading',
            'spinner',
            'icon',
            'logo',
            'avatar',
            'profile',
            'thumbnail-placeholder',
            'no-image',
            'default-image'
        ];
        
        const lowerUrl = url.toLowerCase();
        
        // Проверяем, что это не исключенное изображение
        if (excludePatterns.some(pattern => lowerUrl.includes(pattern))) {
            return false;
        }
        
        // Проверяем, что это изображение
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const hasImageExtension = imageExtensions.some(ext => lowerUrl.includes(ext));
        
        // Проверяем размер изображения в URL (исключаем слишком маленькие)
        const sizeMatch = url.match(/(\d+)x(\d+)/);
        if (sizeMatch) {
            const width = parseInt(sizeMatch[1]);
            const height = parseInt(sizeMatch[2]);
            if (width < 200 || height < 200) {
                return false; // Слишком маленькое изображение
            }
        }
        
        return hasImageExtension || url.includes('image') || url.includes('photo');
    }

    extractDescription($) {
        // Priority 1: The standard ID for the description text
        const idSelector = '#viewad-description-text';
        if ($(idSelector).length > 0) {
            console.log(`✅ Found description via ${idSelector}`);
            const el = $(idSelector).clone();
            el.find('.ad-description-ad-id').remove();
            return el.text().trim();
        }

        // Priority 2: Data attribute
        const testIdSelector = '[data-testid="ad-description-text"]';
        if ($(testIdSelector).length > 0) {
            console.log(`✅ Found description via ${testIdSelector}`);
            return $(testIdSelector).text().trim();
        }

        // Priority 3: Meta tag or specific container
        const metaDesc = $('meta[name="description"]').attr('content');
        if (metaDesc && metaDesc.length > 20) {
            console.log(`✅ Found description via meta tag`);
            return metaDesc;
        }

        // Fallbacks (risky, but sometimes needed)
        const descriptionSelectors = [
            '.boxedarticle--description',
            '.ad-description',
            '[itemprop="description"]'
        ];
        
        for (const selector of descriptionSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                const first = element.first();
                const text = first.text().trim();
                if (text && text.length > 10) { 
                    console.log(`⚠️ Found description via fallback ${selector}`);
                    return text;
                }
            }
        }
        
        console.log('❌ Description not found');
        return '';
    }

    extractLocation($) {
        return $('.boxedarticle--location').text().trim() || 
               $('.ad-location').text().trim() ||
               $('.location-text').text().trim() ||
               '';
    }

    extractCondition($) {
        const conditionText = $('.boxedarticle--details').text() || '';
        
        if (conditionText.includes('Neu') || conditionText.includes('neu')) {
            return 'Новый';
        } else if (conditionText.includes('Sehr gut') || conditionText.includes('sehr gut')) {
            return 'Очень хорошее';
        } else if (conditionText.includes('Gut') || conditionText.includes('gut')) {
            return 'Хорошее';
        } else if (conditionText.includes('Befriedigend') || conditionText.includes('befriedigend')) {
            return 'Удовлетворительное';
        }
        
        return 'Б/у';
    }

    extractSpecs($) {
        const specs = {
            frameSize: null,
            wheelDiameter: null,
            year: null
        };

        // Ищем характеристики в тексте описания
        const fullText = $('body').text();
        
        // Размер рамы (улучшено): поддержка буквенных размеров, комбинаций и диапазона роста
        // Комбинации буквенных размеров: M/L, M-L, M–L
        const sizeCombo = fullText.match(/\b(XXL|XL|L|M|S|XS)\s*[\/\-–]\s*(XXL|XL|L|M|S|XS)\b/i);
        if (sizeCombo) {
            specs.frameSize = `${sizeCombo[1].toUpperCase()}/${sizeCombo[2].toUpperCase()}`;
        }

        // Анкерные ключевые слова рядом с размером: Rh, Rahmenhöhe, Rahmengröße, Größe, Frame Size
        if (!specs.frameSize) {
            const anchored = fullText.match(/\b(?:rh|rahmen(?:höhe|gr(?:ö|oe)ße|groesse)?|frame(?:\s*size)?|gr(?:ö|oe)ße|groesse|size)\s*[:\-]?\s*(XXL|XL|L|M|S|XS)\b/i);
            if (anchored) {
                specs.frameSize = anchored[1].toUpperCase();
            }
        }

        // Скобки: (M), (L), (XL)
        if (!specs.frameSize) {
            const paren = fullText.match(/\((XXL|XL|L|M|S|XS)\)/i);
            if (paren) {
                specs.frameSize = paren[1].toUpperCase();
            }
        }

        // Числовые обозначения: 56cm, 17.5", 29 Zoll
        const cmMatch = fullText.match(/\b(\d{2,3}(?:[.,]\d)?)\s*(?:cm|см)\b/i);
        const inchMatch = fullText.match(/\b(\d{2}(?:[.,]\d)?)\s*(?:\"|”|′|inch|zoll)\b/i);
        const cm = cmMatch ? `${cmMatch[1].replace(',', '.')}cm` : null;
        const inch = inchMatch ? `${inchMatch[1].replace(',', '.')}"` : null;
        if (!specs.frameSize && (cm || inch)) {
            specs.frameSize = cm || inch;
        }

        // Диапазон роста: «geeignet für Körpergröße: ca. 1,75m-1,87m» или «175-187 cm»
        if (!specs.frameSize) {
            const hrMeters = fullText.match(/(?:geeignet\s*f(?:ür|ur)\s*)?k(?:ö|oe)rpergr(?:ö|oe)sse\s*:?\s*(?:ca\.?\s*)?([0-9][0-9.,]{0,2})\s*m\s*[-–—]\s*([0-9][0-9.,]{0,2})\s*m/i);
            const hrCm = fullText.match(/(?:geeignet\s*f(?:ür|ur)\s*)?k(?:ö|oe)rpergr(?:ö|oe)sse\s*:?\s*(?:ca\.?\s*)?([0-9]{2,3}(?:[.,]\d)?)\s*cm\s*[-–—]\s*([0-9]{2,3}(?:[.,]\d)?)\s*cm/i);
            const toMeters = (s) => parseFloat(String(s).replace(',', '.'));
            const heightToLetter = (h) => (h < 1.65 ? 'XS' : h < 1.70 ? 'S' : h < 1.80 ? 'M' : h < 1.90 ? 'L' : 'XL');
            if (hrMeters) {
                const lower = toMeters(hrMeters[1]);
                const upper = toMeters(hrMeters[2]);
                const a = heightToLetter(lower);
                const b = heightToLetter(upper);
                specs.frameSize = a === b ? a : `${a}/${b}`;
            } else if (hrCm) {
                const lower = toMeters(hrCm[1]) / 100;
                const upper = toMeters(hrCm[2]) / 100;
                const a = heightToLetter(lower);
                const b = heightToLetter(upper);
                specs.frameSize = a === b ? a : `${a}/${b}`;
            }
        }

        const wheels = [
            { label: '20"', re: /\b20\s*(?:"|”|inch|zoll)\b/i },
            { label: '24"', re: /\b24\s*(?:"|”|inch|zoll)\b/i },
            { label: '26"', re: /\b26\s*(?:"|”|inch|zoll)\b/i },
            { label: '27.5"', re: /\b(?:27[.,]5|650b)\s*(?:"|”|inch|zoll)?\b/i },
            { label: '29"', re: /\b29\s*(?:"|”|inch|zoll)\b/i },
            { label: '700c', re: /\b700c\b/i }
        ];
        for (const w of wheels) {
            if (w.re.test(fullText)) { specs.wheelDiameter = w.label; break; }
        }

        // Год выпуска
        const yearMatch = fullText.match(/(?:jahr|year|baujahr)[:\s]*(\d{4})/i);
        if (yearMatch) {
            specs.year = parseInt(yearMatch[1]);
        }

        return specs;
    }

    extractAttributes($) {
        const attributes = [];
        const selectors = [
            '.addetailslist--detail',
            '.ad-details li',
            '.details-list li',
            'dl.details dt, dl.details dd'
        ];

        // Specific handling for addetailslist
        $('.addetailslist--detail').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text) attributes.push(text);
        });

        if (attributes.length === 0) {
            // Fallback generic list items in details container
            $('.boxedarticle--details li').each((i, elem) => {
                const text = $(elem).text().trim();
                if (text) attributes.push(text);
            });
        }

        return attributes;
    }

    extractSeller($) {
        // 1. Define Container
        const container = $('#viewad-contact');
        const sidebar = $('aside#viewad-sidebar');

        // 2. Extract Name
        // Try specific VIP selector first, then fallback to general contact name
        let name = container.find('.userprofile-vip a').first().text().trim() || 
                   container.find('#viewad-contact-name').text().trim() ||
                   sidebar.find('.userprofile-vip a').first().text().trim() ||
                   null;

        // 3. Extract Badges
        const badges = [];
        // Look in both container and sidebar for badges
        const badgeContainer = container.find('.profile-userbadges').length ? container : sidebar;
        badgeContainer.find('.profile-userbadges .userbadge').each((i, el) => {
            const txt = $(el).text().trim();
            if (txt) badges.push(txt);
        });

        // 4. Extract Details (Type & Member Since)
        let type = null;
        let memberSince = null;

        // Helper to find text in details
        const findDetail = (keyword) => {
            let result = null;
            // Search in container
            container.find('.userprofile-vip-details').each((i, el) => {
                const text = $(el).text().trim();
                if (text.includes(keyword)) result = text;
            });
            // If not found, search in sidebar
            if (!result) {
                sidebar.find('.userprofile-vip-details').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.includes(keyword)) result = text;
                });
            }
            return result;
        };

        // Get Type
        const typeText = findDetail('Nutzer') || findDetail('Anbieter');
        if (typeText) {
            type = typeText.replace(/\s+/g, ' ').trim();
        }

        // Get Member Since
        const sinceText = findDetail('Aktiv seit');
        if (sinceText) {
            // Extract just the date part if possible, or keep full string
            // "Aktiv seit 10.11.2011" -> "10.11.2011"
            const match = sinceText.match(/Aktiv\s*seit\s*(\d{2}\.\d{2}\.\d{4})/i);
            memberSince = match ? match[1] : sinceText.replace(/\s+/g, ' ').trim();
        }

        // Fallback: Parse from full text if structured search failed
        if (!name || !type || !memberSince) {
            const fullText = container.text() + ' ' + sidebar.text();
            
            if (!type) {
                if (fullText.includes('Privater Nutzer')) type = 'Privater Nutzer';
                else if (fullText.includes('Gewerblicher Anbieter')) type = 'Gewerblicher Anbieter';
            }

            if (!memberSince) {
                const match = fullText.match(/Aktiv\s*seit\s*(\d{2}\.\d{2}\.\d{4})/i);
                if (match) memberSince = match[1];
            }
        }

        return { 
            name, 
            type, 
            memberSince, 
            badges: badges.length ? badges : null 
        };
    }

    extractSourceAdId($) {
        const bodyText = $('body').text();
        const idMatch = bodyText.match(/anzeige\s*-?\s*id\s*[:#]?\s*(\d{6,})/i);
        return idMatch ? idMatch[1] : null;
    }

    parseTitleForBikeInfo(title) {
        const titleLower = title.toLowerCase();
        
        // Определяем категорию
        let category = 'Городской'; // По умолчанию
        
        if (titleLower.includes('mountain') || titleLower.includes('mtb') || titleLower.includes('enduro') || titleLower.includes('downhill')) {
            category = 'Горный';
        } else if (titleLower.includes('road') || titleLower.includes('rennrad') || titleLower.includes('racing')) {
            category = 'Шоссейный';
        } else if (titleLower.includes('e-bike') || titleLower.includes('elektro') || titleLower.includes('electric')) {
            category = 'Электро';
        } else if (titleLower.includes('bmx')) {
            category = 'BMX';
        } else if (titleLower.includes('kinder') || titleLower.includes('kids') || titleLower.includes('child')) {
            category = 'Детский';
        }

        const knownBrands = [
            'trek','giant','specialized','cannondale','scott','merida','cube','canyon','bianchi','orbea','mondraker','commencal','santa cruz','yt','yt industries','propain','nukeproof','pivot','norco','kona','marin','ibis','intense','transition','rocky mountain','lapierre','rose','vitus','radon','polygon','ghost','bmc','bh','ns bikes','devinci','ragley','haibike','focus'
        ];
        const tLower = titleLower;
        let brand = null;
        for (const b of knownBrands.sort((a,b)=>b.length-a.length)) {
            if (tLower.includes(b)) {
                const up = b.replace(/\b\w/g, (m) => m.toUpperCase());
                if (up === 'Yt' || up === 'Yt Industries') brand = 'YT';
                else if (up === 'Bh') brand = 'BH';
                else if (up === 'Bmc') brand = 'BMC';
                else if (up === 'Ns Bikes') brand = 'NS Bikes';
                else brand = up;
                break;
            }
        }
        const generic = ['fahrrad','bike','mountainbike','downhillbike'];
        if (!brand) {
            const words = title.split(/\s+/).filter(w => w.length > 1);
            const cand = words.find(w => !generic.includes(w.toLowerCase()));
            brand = cand || 'Unknown';
        }
        const modelRaw = title.replace(new RegExp(brand.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'), '').trim();
        let model = modelRaw.replace(/^[\s:\-–]+/, '').trim();
        model = model.replace(/^(downhillbike|mountainbike|fahrrad|bike)\s*/i, '').trim();
        if (!model) model = 'Model';

        return { brand, model, category };
    }

    checkIfNegotiable($) {
        // Ищем VB в цене или рядом с ценой
        const priceText = $('.boxedarticle--price, .price-element, .ad-price, #viewad-price').text();
        // User requested simple check: priceString.includes('VB')
        return priceText.includes('VB') || 
               priceText.toLowerCase().includes('verhandlungsbasis') || 
               priceText.toLowerCase().includes('verhandelbar');
    }

    extractDeliveryOption($, description = null) {
        // Ищем информацию о доставке в специфических областях
        // .boxedarticle--details - often contains "Nur Abholung"
        // #viewad-price - contains price and often "+ Versand ab ..."
        const deliverySelectors = [
            '#viewad-price',
            '.boxedarticle--price',
            '.ad-price',
            '.price-element',
            '.viewad-price',
            '[class*="price"]',
            '.ad-shipping-details',
            '.shipping',
            '.boxedarticle--details',
            '#viewad-main-info'
        ];
        
        let deliveryText = '';
        for (const selector of deliverySelectors) {
            const element = $(selector);
            if (element.length > 0) {
                const txt = element.text().replace(/\s+/g, ' ').trim();
                deliveryText += ' ' + txt;
            }
        }
        
        const cleanText = deliveryText.trim();
        // console.log(`DEBUG Delivery Text: "${cleanText}"`);
        
        // 1. Explicit Shipping Cost/Available
        // "+ Versand ab 4,89 €" -> Available
        // "Versand möglich" -> Available
        if (/Versand\s*(?:ab|möglich)/i.test(cleanText) || /\+\s*Versand/i.test(cleanText)) {
            return 'available';
        }

        // 2. Explicit Pickup Only
        if (/Nur\s*Abholung/i.test(cleanText) || /Kein\s*Versand/i.test(cleanText)) {
            return 'pickup-only';
        }

        // 3. Fallback: Check description
        const desc = description || this.extractDescription($);
        if (desc) {
            if (/Versand\s*möglich/i.test(desc) || /Versand\s*gegen\s*Aufpreis/i.test(desc)) {
                return 'available';
            }
            if (/Nur\s*Abholung/i.test(desc)) {
                return 'pickup-only';
            }
        }

        // Default to pickup-only for bikes if no explicit shipping info found (safest bet)
        return 'pickup-only';
    }

    getCleanedHtmlForGemini($) {
        // Удаляем ненужные элементы для Gemini
        $('script, style, nav, header, footer, .navigation, .menu, .sidebar').remove();
        $('.recommendations, .similar-ads, .related-ads, [class*="recommendation"]').remove();
        $('.advertisement, .ads, [class*="ad-"], [id*="ad-"]').remove();
        $('.cookie, .gdpr, .privacy, [class*="cookie"], [class*="gdpr"]').remove();
        
        // Извлекаем только основной контент
        const mainContent = $('.boxedarticle, .ad-content, .main-content, main, article').first();
        
        if (mainContent.length > 0) {
            return mainContent.text().trim();
        }
        
        // Если основной контент не найден, возвращаем очищенный body
        return $('body').text().trim().substring(0, 5000); // Ограничиваем размер
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = KleinanzeigenParser;
