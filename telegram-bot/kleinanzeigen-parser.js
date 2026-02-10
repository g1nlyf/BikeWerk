const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');

const DEFAULT_PROXY_URL = '';

class KleinanzeigenParser {
    constructor() {
        this.corsProxies = [
            'https://api.allorigins.win/get?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://thingproxy.freeboard.io/fetch/',
            'https://api.codetabs.com/v1/proxy?quest='
        ];
        
        this.timeout = 5000; // 5 Ã‘ÂÃÂµÃÂºÃ‘Æ’ÃÂ½ÃÂ´
        this.retryAttempts = 2;

        this.proxyUrl =
            process.env.EUBIKE_PROXY_URL ||
            process.env.HUNTER_PROXY_URL ||
            process.env.HTTPS_PROXY ||
            process.env.HTTP_PROXY ||
            process.env.PROXY_URL ||
            DEFAULT_PROXY_URL;
        this.proxyAgent = this.proxyUrl ? new HttpsProxyAgent(this.proxyUrl) : undefined;
    }

    async parseKleinanzeigenLink(url) {
        console.log(`Ã°Å¸â€Â ÃÂÃÂ°Ã‘â€¡ÃÂ¸ÃÂ½ÃÂ°Ã‘Å½ ÃÂ¿ÃÂ°Ã‘â‚¬Ã‘ÂÃÂ¸ÃÂ½ÃÂ³ Ã‘ÂÃ‘ÂÃ‘â€¹ÃÂ»ÃÂºÃÂ¸: ${url}`);
        
        try {
            // Ãâ€™ÃÂ°ÃÂ»ÃÂ¸ÃÂ´ÃÂ°Ã‘â€ ÃÂ¸Ã‘Â URL
            if (!this.isValidKleinanzeigenUrl(url)) {
                throw new Error('ÃÂÃÂµÃÂ²ÃÂµÃ‘â‚¬ÃÂ½ÃÂ°Ã‘Â Ã‘ÂÃ‘ÂÃ‘â€¹ÃÂ»ÃÂºÃÂ° ÃÂ½ÃÂ° Kleinanzeigen');
            }

            // ÃÅ¸ÃÂ¾ÃÂ»Ã‘Æ’Ã‘â€¡ÃÂ°ÃÂµÃÂ¼ HTML ÃÂºÃÂ¾ÃÂ½Ã‘â€šÃÂµÃÂ½Ã‘â€š
            const htmlContent = await this.fetchHtmlContent(url);
            
            // ÃÅ¸ÃÂ°Ã‘â‚¬Ã‘ÂÃÂ¸ÃÂ¼ HTML ÃÂ¸ ÃÂ¸ÃÂ·ÃÂ²ÃÂ»ÃÂµÃÂºÃÂ°ÃÂµÃÂ¼ ÃÂ´ÃÂ°ÃÂ½ÃÂ½Ã‘â€¹ÃÂµ
            const bikeData = this.extractBikeData(htmlContent, url);
            if (this.isUnavailableListingPage(bikeData, htmlContent)) {
                throw new Error('ÃÅ¾ÃÂ±Ã‘Å Ã‘ÂÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ½ÃÂµÃÂ´ÃÂ¾Ã‘ÂÃ‘â€šÃ‘Æ’ÃÂ¿ÃÂ½ÃÂ¾ ÃÂ¸ÃÂ»ÃÂ¸ Ã‘Æ’ÃÂ´ÃÂ°ÃÂ»ÃÂµÃÂ½ÃÂ¾ (Ã‘â‚¬ÃÂµÃÂ´ÃÂ¸Ã‘â‚¬ÃÂµÃÂºÃ‘â€š ÃÂ½ÃÂ° Ã‘ÂÃ‘â€šÃ‘â‚¬ÃÂ°ÃÂ½ÃÂ¸Ã‘â€ Ã‘Æ’ Ã‘â‚¬ÃÂµÃÂ·Ã‘Æ’ÃÂ»Ã‘Å’Ã‘â€šÃÂ°Ã‘â€šÃÂ¾ÃÂ²)');
            }
            
            console.log('Ã¢Å“â€¦ Ãâ€ÃÂ°ÃÂ½ÃÂ½Ã‘â€¹ÃÂµ Ã‘Æ’Ã‘ÂÃÂ¿ÃÂµÃ‘Ë†ÃÂ½ÃÂ¾ ÃÂ¸ÃÂ·ÃÂ²ÃÂ»ÃÂµÃ‘â€¡ÃÂµÃÂ½Ã‘â€¹:', bikeData);
            return bikeData;
            
        } catch (error) {
            console.error('Ã¢ÂÅ’ ÃÅ¾Ã‘Ë†ÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂ¿Ã‘â‚¬ÃÂ¸ ÃÂ¿ÃÂ°Ã‘â‚¬Ã‘ÂÃÂ¸ÃÂ½ÃÂ³ÃÂµ:', error.message);
            throw error;
        }
    }

    isValidKleinanzeigenUrl(url) {
        const kleinanzeigenPattern = /^https?:\/\/(www\.)?kleinanzeigen\.de\/s-anzeige\/.+/;
        return kleinanzeigenPattern.test(url);
    }

    async fetchHtmlContent(url) {
        let lastError;
        
        // ÃÂ¡ÃÂ½ÃÂ°Ã‘â€¡ÃÂ°ÃÂ»ÃÂ° ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂ±Ã‘Æ’ÃÂµÃÂ¼ ÃÂ¿Ã‘â‚¬Ã‘ÂÃÂ¼ÃÂ¾ÃÂ¹ ÃÂ·ÃÂ°ÃÂ¿Ã‘â‚¬ÃÂ¾Ã‘Â ÃÂ±ÃÂµÃÂ· ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂºÃ‘ÂÃÂ¸ (ÃÂ² Node CORS ÃÂ½ÃÂµ ÃÂ¼ÃÂµÃ‘Ë†ÃÂ°ÃÂµÃ‘â€š)
        try {
            console.log(`Ã°Å¸Å’Â ÃÅ¸Ã‘â‚¬Ã‘ÂÃÂ¼ÃÂ¾ÃÂ¹ ÃÂ·ÃÂ°ÃÂ¿Ã‘â‚¬ÃÂ¾Ã‘Â ÃÂ±ÃÂµÃÂ· ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂºÃ‘ÂÃÂ¸`);
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
                    console.log('Ã¢Å“â€¦ HTML ÃÂºÃÂ¾ÃÂ½Ã‘â€šÃÂµÃÂ½Ã‘â€š Ã‘Æ’Ã‘ÂÃÂ¿ÃÂµÃ‘Ë†ÃÂ½ÃÂ¾ ÃÂ¿ÃÂ¾ÃÂ»Ã‘Æ’Ã‘â€¡ÃÂµÃÂ½ ÃÂ½ÃÂ°ÃÂ¿Ã‘â‚¬Ã‘ÂÃÂ¼Ã‘Æ’Ã‘Å½');
                    return directHtml;
                }
            } else {
                lastError = new Error(`Direct HTTP ${directResp.status}: ${directResp.statusText}`);
            }
        } catch (e) {
            lastError = e;
            console.log(`Ã¢ÂÅ’ ÃÅ¾Ã‘Ë†ÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂ¿Ã‘â‚¬Ã‘ÂÃÂ¼ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ·ÃÂ°ÃÂ¿Ã‘â‚¬ÃÂ¾Ã‘ÂÃÂ°: ${e.message}`);
        }
        
        // ÃÅ¸Ã‘â‚¬ÃÂ¾ÃÂ±Ã‘Æ’ÃÂµÃÂ¼ Ã‘â‚¬ÃÂ°ÃÂ·ÃÂ½Ã‘â€¹ÃÂµ CORS ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂºÃ‘ÂÃÂ¸
        for (const proxy of this.corsProxies) {
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    console.log(`Ã°Å¸Å’Â ÃÅ¸ÃÂ¾ÃÂ¿Ã‘â€¹Ã‘â€šÃÂºÃÂ° ${attempt}/${this.retryAttempts} Ã‘Â ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂºÃ‘ÂÃÂ¸: ${proxy}`);
                    
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
                    
                    // Ãâ€ÃÂ»Ã‘Â ÃÂ½ÃÂµÃÂºÃÂ¾Ã‘â€šÃÂ¾Ã‘â‚¬Ã‘â€¹Ã‘â€¦ ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂºÃ‘ÂÃÂ¸ ÃÂ½Ã‘Æ’ÃÂ¶ÃÂ½ÃÂ¾ ÃÂ¸ÃÂ·ÃÂ²ÃÂ»ÃÂµÃ‘â€¡Ã‘Å’ Ã‘ÂÃÂ¾ÃÂ´ÃÂµÃ‘â‚¬ÃÂ¶ÃÂ¸ÃÂ¼ÃÂ¾ÃÂµ ÃÂ¸ÃÂ· JSON
                    if (proxy.includes('allorigins')) {
                        const jsonData = JSON.parse(content);
                        content = jsonData.contents;
                    }

                    if (content && content.length > 1000) {
                        console.log('Ã¢Å“â€¦ HTML ÃÂºÃÂ¾ÃÂ½Ã‘â€šÃÂµÃÂ½Ã‘â€š Ã‘Æ’Ã‘ÂÃÂ¿ÃÂµÃ‘Ë†ÃÂ½ÃÂ¾ ÃÂ¿ÃÂ¾ÃÂ»Ã‘Æ’Ã‘â€¡ÃÂµÃÂ½');
                        return content;
                    } else {
                        throw new Error('ÃÅ¸ÃÂ¾ÃÂ»Ã‘Æ’Ã‘â€¡ÃÂµÃÂ½ ÃÂ¿Ã‘Æ’Ã‘ÂÃ‘â€šÃÂ¾ÃÂ¹ ÃÂ¸ÃÂ»ÃÂ¸ Ã‘ÂÃÂ»ÃÂ¸Ã‘Ë†ÃÂºÃÂ¾ÃÂ¼ ÃÂºÃÂ¾Ã‘â‚¬ÃÂ¾Ã‘â€šÃÂºÃÂ¸ÃÂ¹ ÃÂºÃÂ¾ÃÂ½Ã‘â€šÃÂµÃÂ½Ã‘â€š');
                    }

                } catch (error) {
                    lastError = error;
                    console.log(`Ã¢ÂÅ’ ÃÅ¾Ã‘Ë†ÃÂ¸ÃÂ±ÃÂºÃÂ° Ã‘Â ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂºÃ‘ÂÃÂ¸ ${proxy}, ÃÂ¿ÃÂ¾ÃÂ¿Ã‘â€¹Ã‘â€šÃÂºÃÂ° ${attempt}: ${error.message}`);
                    
                    if (attempt < this.retryAttempts) {
                        await this.delay(1000 * attempt); // ÃÂ£ÃÂ²ÃÂµÃÂ»ÃÂ¸Ã‘â€¡ÃÂ¸ÃÂ²ÃÂ°ÃÂµÃÂ¼ ÃÂ·ÃÂ°ÃÂ´ÃÂµÃ‘â‚¬ÃÂ¶ÃÂºÃ‘Æ’ Ã‘Â ÃÂºÃÂ°ÃÂ¶ÃÂ´ÃÂ¾ÃÂ¹ ÃÂ¿ÃÂ¾ÃÂ¿Ã‘â€¹Ã‘â€šÃÂºÃÂ¾ÃÂ¹
                    }
                }
            }
        }

        throw new Error(`ÃÂÃÂµ Ã‘Æ’ÃÂ´ÃÂ°ÃÂ»ÃÂ¾Ã‘ÂÃ‘Å’ ÃÂ¿ÃÂ¾ÃÂ»Ã‘Æ’Ã‘â€¡ÃÂ¸Ã‘â€šÃ‘Å’ HTML ÃÂºÃÂ¾ÃÂ½Ã‘â€šÃÂµÃÂ½Ã‘â€š ÃÂ¿ÃÂ¾Ã‘ÂÃÂ»ÃÂµ ÃÂ²Ã‘ÂÃÂµÃ‘â€¦ ÃÂ¿ÃÂ¾ÃÂ¿Ã‘â€¹Ã‘â€šÃÂ¾ÃÂº. ÃÅ¸ÃÂ¾Ã‘ÂÃÂ»ÃÂµÃÂ´ÃÂ½Ã‘ÂÃ‘Â ÃÂ¾Ã‘Ë†ÃÂ¸ÃÂ±ÃÂºÃÂ°: ${lastError?.message}`);
    }

    extractBikeData(html, originalUrl) {
        const $ = cheerio.load(html);
        
        // ÃÂ£ÃÂ´ÃÂ°ÃÂ»Ã‘ÂÃÂµÃÂ¼ ÃÂ±ÃÂ»ÃÂ¾ÃÂº Ã‘â‚¬ÃÂµÃÂºÃÂ¾ÃÂ¼ÃÂµÃÂ½ÃÂ´ÃÂ°Ã‘â€ ÃÂ¸ÃÂ¹, Ã‘â€¡Ã‘â€šÃÂ¾ÃÂ±Ã‘â€¹ ÃÂ¾ÃÂ½ ÃÂ½ÃÂµ ÃÂ¼ÃÂµÃ‘Ë†ÃÂ°ÃÂ» ÃÂ¿ÃÂ°Ã‘â‚¬Ã‘ÂÃÂ¸ÃÂ½ÃÂ³Ã‘Æ’
        $('.recommendations, .similar-ads, .related-ads, [class*="recommendation"], [class*="similar"], [class*="related"]').remove();
        $('section:contains("Das kÃƒÂ¶nnte dich auch interessieren")').remove();
        $('div:contains("Das kÃƒÂ¶nnte dich auch interessieren")').remove();
        
        // ÃËœÃÂ·ÃÂ²ÃÂ»ÃÂµÃÂºÃÂ°ÃÂµÃÂ¼ ÃÂ¾Ã‘ÂÃÂ½ÃÂ¾ÃÂ²ÃÂ½Ã‘Æ’Ã‘Å½ ÃÂ¸ÃÂ½Ã‘â€žÃÂ¾Ã‘â‚¬ÃÂ¼ÃÂ°Ã‘â€ ÃÂ¸Ã‘Å½
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
        const sourceAdId = this.extractSourceAdId($, originalUrl);
        const deliveryOption = this.extractDeliveryOption($, description);
        const isNegotiable = this.checkIfNegotiable($);
        
        // Sprint 1.4: Hotness Radar Data
        const views = this.extractViews($);
        const publishDate = this.extractPublishDate($);

        // ÃÅ¸ÃÂ°Ã‘â‚¬Ã‘ÂÃÂ¸ÃÂ¼ ÃÂ·ÃÂ°ÃÂ³ÃÂ¾ÃÂ»ÃÂ¾ÃÂ²ÃÂ¾ÃÂº ÃÂ´ÃÂ»Ã‘Â ÃÂ¿ÃÂ¾ÃÂ»Ã‘Æ’Ã‘â€¡ÃÂµÃÂ½ÃÂ¸Ã‘Â ÃÂ±Ã‘â‚¬ÃÂµÃÂ½ÃÂ´ÃÂ° ÃÂ¸ ÃÂ¼ÃÂ¾ÃÂ´ÃÂµÃÂ»ÃÂ¸
        const { brand, model, category } = this.parseTitleForBikeInfo(title);
        
        // ÃÅ¸ÃÂ¾ÃÂ»Ã‘Æ’Ã‘â€¡ÃÂ°ÃÂµÃÂ¼ ÃÂ¾Ã‘â€¡ÃÂ¸Ã‘â€°ÃÂµÃÂ½ÃÂ½Ã‘â€¹ÃÂ¹ HTML ÃÂ´ÃÂ»Ã‘Â ÃÂ¿ÃÂµÃ‘â‚¬ÃÂµÃÂ´ÃÂ°Ã‘â€¡ÃÂ¸ ÃÂ² Gemini
        const cleanedHtml = this.getCleanedHtmlForGemini($);
        
        return {
            title,
            brand,
            model,
            category,
            price,
            originalPrice, // Ãâ€”ÃÂ°ÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂµÃÂ½ÃÂ¾ ÃÂ¸ÃÂ· ÃÂ¿ÃÂ°Ã‘â‚¬Ã‘ÂÃÂµÃ‘â‚¬ÃÂ° ÃÂ¸ÃÂ»ÃÂ¸ ÃÂ±Ã‘Æ’ÃÂ´ÃÂµÃ‘â€š ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¾ ÃÂµÃ‘ÂÃÂ»ÃÂ¸ ÃÂµÃ‘ÂÃ‘â€šÃ‘Å’ Ã‘ÂÃÂºÃÂ¸ÃÂ´ÃÂºÃÂ°
            images,
            description,
            attributes, // Ãâ€ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ»Ã‘ÂÃÂµÃÂ¼ ÃÂ¸ÃÂ·ÃÂ²ÃÂ»ÃÂµÃ‘â€¡ÃÂµÃÂ½ÃÂ½Ã‘â€¹ÃÂµ ÃÂ°Ã‘â€šÃ‘â‚¬ÃÂ¸ÃÂ±Ã‘Æ’Ã‘â€šÃ‘â€¹
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
            sellerLastActive: seller.lastActive || null,
            sellerType: seller.type || null,
            sourceAdId: sourceAdId || null,
            views,
            publishDate
        };
    }

    isUnavailableListingPage(bikeData, htmlContent) {
        const title = String(bikeData?.title || '').toLowerCase();
        const description = String(bikeData?.description || '').toLowerCase();
        const price = Number(bikeData?.price || 0);
        const imageCount = Array.isArray(bikeData?.images) ? bikeData.images.length : 0;
        const text = String(htmlContent || '').toLowerCase();

        const searchMarkers = [
            'ergebnisse in',
            'fahrrÃƒÂ¤der & zubehÃƒÂ¶r in',
            'kleinanzeigen:',
            'sortieren nach',
            'alle kategorien',
            'jetzt in',
            'finden oder inserieren'
        ];
        const hasSearchMarker = searchMarkers.some(marker => title.includes(marker) || description.includes(marker) || text.includes(marker));
        const hasAdDetailMarker = text.includes('viewad-title') || text.includes('boxedarticle') || text.includes('viewad-price');
        const hasResultCounter = /\b\d+\s*-\s*\d+\s*von\s*\d+\s*ergebnissen\b/.test(title)
            || /\b\d+\s*-\s*\d+\s*von\s*\d+\s*ergebnissen\b/.test(description)
            || /\b\d+\s*-\s*\d+\s*von\s*\d+\s*ergebnissen\b/.test(text);
        const likelySearchResultPage = (hasSearchMarker || hasResultCounter) && !hasAdDetailMarker;

        // sourceAdId can be extracted from URL even for deleted ads, so it is not a reliable signal.
        if (likelySearchResultPage) return true;
        if (price <= 0 && imageCount === 0 && (hasSearchMarker || hasResultCounter)) return true;
        return false;
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
               'Ãâ€™ÃÂµÃÂ»ÃÂ¾Ã‘ÂÃÂ¸ÃÂ¿ÃÂµÃÂ´';
    }

    extractPrice($) {
        const priceText = $('.boxedarticle--price').text().trim() || 
                         $('.price-element').text().trim() ||
                         $('.ad-price').text().trim();
        return this.parsePriceString(priceText);
    }

    extractOriginalPrice($) {
        // Try explicit old price selectors first
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

        // Fallback: UVP/Neupreis in focused ad content (avoid full body noise/scripts).
        // Some Kleinanzeigen descriptions are collapsed without separators:
        // "... ZustandUVP: 5.599 €Privatverkauf ...".
        const text = [
            this.extractDescription($),
            $('#viewad-description-text').text(),
            $('.boxedarticle--details').text(),
            $('#viewad-main-info').text()
        ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ');

        const labeledPriceRegex =
            /(?:uvp|neupreis|np|original(?:er)?\s*preis|original\s*price)\s*(?:war\s*)?[:\-]?\s*([0-9][0-9.,\s]{2,})(?:\s*(?:€|eur|euro|\u20ac))?/gi;
        let match;
        while ((match = labeledPriceRegex.exec(text)) !== null) {
            const parsed = this.parsePriceString(match[1] || '');
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
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
        
        // ÃÅ¸Ã‘â‚¬ÃÂ¾Ã‘â€¦ÃÂ¾ÃÂ´ÃÂ¸ÃÂ¼ ÃÂ¿ÃÂ¾ ÃÂ²Ã‘ÂÃÂµÃÂ¼ Ã‘ÂÃÂµÃÂ»ÃÂµÃÂºÃ‘â€šÃÂ¾Ã‘â‚¬ÃÂ°ÃÂ¼
        imageSelectors.forEach(selector => {
            $(selector).each((i, elem) => {
                const src = $(elem).attr('src') || 
                           $(elem).attr('data-src') || 
                           $(elem).attr('data-original') ||
                           $(elem).attr('data-lazy');
                           
                addImage(src);
            });
        });

        console.log(`Ã°Å¸â€“Â¼Ã¯Â¸Â ÃÂÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½ÃÂ¾ ${images.length} ÃÂ¸ÃÂ·ÃÂ¾ÃÂ±Ã‘â‚¬ÃÂ°ÃÂ¶ÃÂµÃÂ½ÃÂ¸ÃÂ¹`);
        return images;
    }

    isValidImageUrl(url) {
        if (!url) return false;
        
        // ÃËœÃ‘ÂÃÂºÃÂ»Ã‘Å½Ã‘â€¡ÃÂ°ÃÂµÃÂ¼ ÃÂ½ÃÂµÃÂ¶ÃÂµÃÂ»ÃÂ°Ã‘â€šÃÂµÃÂ»Ã‘Å’ÃÂ½Ã‘â€¹ÃÂµ ÃÂ¸ÃÂ·ÃÂ¾ÃÂ±Ã‘â‚¬ÃÂ°ÃÂ¶ÃÂµÃÂ½ÃÂ¸Ã‘Â
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
        
        // ÃÅ¸Ã‘â‚¬ÃÂ¾ÃÂ²ÃÂµÃ‘â‚¬Ã‘ÂÃÂµÃÂ¼, Ã‘â€¡Ã‘â€šÃÂ¾ Ã‘ÂÃ‘â€šÃÂ¾ ÃÂ½ÃÂµ ÃÂ¸Ã‘ÂÃÂºÃÂ»Ã‘Å½Ã‘â€¡ÃÂµÃÂ½ÃÂ½ÃÂ¾ÃÂµ ÃÂ¸ÃÂ·ÃÂ¾ÃÂ±Ã‘â‚¬ÃÂ°ÃÂ¶ÃÂµÃÂ½ÃÂ¸ÃÂµ
        if (excludePatterns.some(pattern => lowerUrl.includes(pattern))) {
            return false;
        }
        
        // ÃÅ¸Ã‘â‚¬ÃÂ¾ÃÂ²ÃÂµÃ‘â‚¬Ã‘ÂÃÂµÃÂ¼, Ã‘â€¡Ã‘â€šÃÂ¾ Ã‘ÂÃ‘â€šÃÂ¾ ÃÂ¸ÃÂ·ÃÂ¾ÃÂ±Ã‘â‚¬ÃÂ°ÃÂ¶ÃÂµÃÂ½ÃÂ¸ÃÂµ
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const hasImageExtension = imageExtensions.some(ext => lowerUrl.includes(ext));
        
        // ÃÅ¸Ã‘â‚¬ÃÂ¾ÃÂ²ÃÂµÃ‘â‚¬Ã‘ÂÃÂµÃÂ¼ Ã‘â‚¬ÃÂ°ÃÂ·ÃÂ¼ÃÂµÃ‘â‚¬ ÃÂ¸ÃÂ·ÃÂ¾ÃÂ±Ã‘â‚¬ÃÂ°ÃÂ¶ÃÂµÃÂ½ÃÂ¸Ã‘Â ÃÂ² URL (ÃÂ¸Ã‘ÂÃÂºÃÂ»Ã‘Å½Ã‘â€¡ÃÂ°ÃÂµÃÂ¼ Ã‘ÂÃÂ»ÃÂ¸Ã‘Ë†ÃÂºÃÂ¾ÃÂ¼ ÃÂ¼ÃÂ°ÃÂ»ÃÂµÃÂ½Ã‘Å’ÃÂºÃÂ¸ÃÂµ)
        const sizeMatch = url.match(/(\d+)x(\d+)/);
        if (sizeMatch) {
            const width = parseInt(sizeMatch[1]);
            const height = parseInt(sizeMatch[2]);
            if (width < 200 || height < 200) {
                return false; // ÃÂ¡ÃÂ»ÃÂ¸Ã‘Ë†ÃÂºÃÂ¾ÃÂ¼ ÃÂ¼ÃÂ°ÃÂ»ÃÂµÃÂ½Ã‘Å’ÃÂºÃÂ¾ÃÂµ ÃÂ¸ÃÂ·ÃÂ¾ÃÂ±Ã‘â‚¬ÃÂ°ÃÂ¶ÃÂµÃÂ½ÃÂ¸ÃÂµ
            }
        }
        
        return hasImageExtension || url.includes('image') || url.includes('photo');
    }

    extractDescription($) {
        // Priority 1: The standard ID for the description text
        const idSelector = '#viewad-description-text';
        if ($(idSelector).length > 0) {
            console.log(`Ã¢Å“â€¦ Found description via ${idSelector}`);
            const el = $(idSelector).clone();
            el.find('.ad-description-ad-id').remove();
            return el.text().trim();
        }

        // Priority 2: Data attribute
        const testIdSelector = '[data-testid="ad-description-text"]';
        if ($(testIdSelector).length > 0) {
            console.log(`Ã¢Å“â€¦ Found description via ${testIdSelector}`);
            return $(testIdSelector).text().trim();
        }

        // Priority 3: Meta tag or specific container
        const metaDesc = $('meta[name="description"]').attr('content');
        if (metaDesc && metaDesc.length > 20) {
            console.log(`Ã¢Å“â€¦ Found description via meta tag`);
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
                    console.log(`Ã¢Å¡Â Ã¯Â¸Â Found description via fallback ${selector}`);
                    return text;
                }
            }
        }
        
        console.log('Ã¢ÂÅ’ Description not found');
        return '';
    }

        extractLocation($) {
        const direct =
            $('.boxedarticle--location').text().trim() ||
            $('.ad-location').text().trim() ||
            $('.location-text').text().trim() ||
            $('[data-testid="ad-location"]').text().trim() ||
            $('#viewad-locality').text().trim() ||
            '';
        if (direct) return direct.replace(/\s+/g, ' ').trim();

        const fullText = $('body').text().replace(/\s+/g, ' ');
        const zipWithCity = fullText.match(/\b\d{5}\s+[A-Za-zÀ-ÿ.\- ]{2,80}(?:-\s*[A-Za-zÀ-ÿ.\- ]{2,80})?/);
        return zipWithCity ? zipWithCity[0].trim() : '';
    }
        extractCondition($) {
        const source = [
            $('.boxedarticle--details').text(),
            $('.addetailslist--detail').text(),
            $('.aditem-main--middle--description').text(),
            $('body').text()
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        if (/\bneu\b|\bneuwertig\b/.test(source)) return 'new';
        if (/\bsehr\s+gut\b/.test(source)) return 'very_good';
        if (/\bgut\b/.test(source)) return 'good';
        if (/\bbefriedigend\b|\bok\b/.test(source)) return 'fair';

        return 'used';
    }
    extractSpecs($) {
        const specs = {
            frameSize: null,
            wheelDiameter: null,
            year: null
        };

        const focusedText = [
            this.extractDescription($),
            $('.addetailslist--detail').text(),
            $('.boxedarticle--details').text(),
            $('#viewad-main-info').text()
        ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ');
        const fullText = `${focusedText} ${$('body').text().slice(0, 4000)}`.replace(/\s+/g, ' ');

        const sizeCombo = focusedText.match(/\b(XXL|XL|L|M|S|XS)\s*[\/-]\s*(XXL|XL|L|M|S|XS)\b/i);
        if (sizeCombo) specs.frameSize = `${sizeCombo[1].toUpperCase()}/${sizeCombo[2].toUpperCase()}`;

        if (!specs.frameSize) {
            const letter = focusedText.match(/(?:rahmengr(?:ö|oe|o)ße|rahmengroesse|frame\s*size|size)\s*[:\-]?\s*(XXL|XL|L|M|S|XS)(?=(?:\s|$|[A-ZÄÖÜ][a-zäöüß]{2,24}\s*:))/i);
            if (letter) specs.frameSize = letter[1].toUpperCase();
        }

        if (!specs.frameSize) {
            const cm = focusedText.match(/(?:rahmengr(?:ö|oe|o)ße|rahmengroesse|frame\s*size|size)\s*[:\-]?\s*(\d{2,3}(?:[.,]\d)?)\s*cm(?=(?:\s|$|[A-ZÄÖÜ][a-zäöüß]{2,24}\s*:))/i);
            if (cm) specs.frameSize = `${cm[1].replace(',', '.')} cm`;
        }

        if (!specs.frameSize) {
            const inch = focusedText.match(/(?:rahmengr(?:ö|oe|o)ße|rahmengroesse|frame\s*size|size)\s*[:\-]?\s*(\d{2}(?:[.,]\d)?)\s*(?:"|inch|zoll)(?=(?:\s|$|[A-ZÄÖÜ][a-zäöüß]{2,24}\s*:))/i);
            if (inch) specs.frameSize = `${inch[1].replace(',', '.')}"`;
        }

        const wheelPatterns = [
            { label: 'mullet', re: /\b(mullet|mallet|mx|mixed)\b/i },
            { label: '29', re: /\b29\s*(?:"|inch|zoll)?\b/i },
            { label: '27.5', re: /\b(?:27[.,]5|650b)\s*(?:"|inch|zoll)?\b/i },
            { label: '26', re: /\b26\s*(?:"|inch|zoll)?\b/i },
            { label: '700c', re: /\b700c\b/i }
        ];
        for (const pattern of wheelPatterns) {
            if (pattern.re.test(fullText)) {
                specs.wheelDiameter = pattern.label;
                break;
            }
        }

        const yearMatch = fullText.match(/\b(?:jahr|year|baujahr|modelljahr)\s*[:\-]?\s*(20\d{2})\b/i);
        if (yearMatch) {
            specs.year = parseInt(yearMatch[1], 10);
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
        let lastActive = null;

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

        if (!memberSince) {
            const bodyText = $('body').text();
            const match = bodyText.match(/Aktiv\s*seit\s*(\d{2}\.\d{2}\.\d{4})/i);
            if (match) memberSince = match[1];
        }

                const activityText = (container.text() + ' ' + sidebar.text()).replace(/\s+/g, ' ');
        const lastActiveMatch = activityText.match(/(?:Zuletzt\s*aktiv|Last\s*active)\s*:?\s*([^.\n\r]{2,40})/i);
        if (lastActiveMatch && lastActiveMatch[1]) {
            lastActive = lastActiveMatch[1].trim();
        }

        return {
            name,
            type,
            memberSince,
            lastActive,
            badges: badges.length ? badges : null
        };
    }

    extractSourceAdId($, originalUrl = '') {
        const bodyText = $('body').text();
        const idMatch = bodyText.match(/anzeige\s*-?\s*id\s*[:#]?\s*(\d{6,})/i);
        if (idMatch) return idMatch[1];
        const fromUrl = String(originalUrl || '').match(/\/(\d{6,})-\d+-\d+/);
        return fromUrl ? fromUrl[1] : null;
    }

    parseTitleForBikeInfo(title) {
        const titleLower = title.toLowerCase();

        let category = 'city';
        if (titleLower.includes('e-bike') || titleLower.includes('ebike') || titleLower.includes('e mtb') || titleLower.includes('elektro') || titleLower.includes('electric')) {
            category = 'emtb';
        } else if (titleLower.includes('mountain') || titleLower.includes('mtb') || titleLower.includes('enduro') || titleLower.includes('downhill')) {
            category = 'mtb';
        } else if (titleLower.includes('road') || titleLower.includes('rennrad') || titleLower.includes('racing')) {
            category = 'road';
        } else if (titleLower.includes('bmx')) {
            category = 'bmx';
        } else if (titleLower.includes('kinder') || titleLower.includes('kids') || titleLower.includes('child')) {
            category = 'kids';
        }

        const knownBrands = [
            'trek', 'giant', 'specialized', 'cannondale', 'scott', 'merida', 'cube', 'canyon', 'bianchi', 'orbea',
            'mondraker', 'commencal', 'santa cruz', 'yt', 'yt industries', 'propain', 'nukeproof', 'pivot',
            'norco', 'kona', 'marin', 'ibis', 'intense', 'transition', 'rocky mountain', 'lapierre', 'rose',
            'vitus', 'radon', 'polygon', 'ghost', 'bmc', 'bh', 'ns bikes', 'devinci', 'ragley', 'haibike', 'focus'
        ];

        let brand = null;
        for (const candidateBrand of knownBrands.sort((a, b) => b.length - a.length)) {
            if (titleLower.includes(candidateBrand)) {
                const up = candidateBrand.replace(/\b\w/g, (m) => m.toUpperCase());
                if (up === 'Yt' || up === 'Yt Industries') brand = 'YT';
                else if (up === 'Bh') brand = 'BH';
                else if (up === 'Bmc') brand = 'BMC';
                else if (up === 'Ns Bikes') brand = 'NS Bikes';
                else brand = up;
                break;
            }
        }

        const generic = ['fahrrad', 'bike', 'mountainbike', 'downhillbike'];
        if (!brand) {
            const words = title.split(/\s+/).filter((word) => word.length > 1);
            const candidate = words.find((word) => !generic.includes(word.toLowerCase()));
            brand = candidate || 'Unknown';
        }

        const brandRegex = new RegExp(brand.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        const modelRaw = title.replace(brandRegex, '').trim();
        let model = modelRaw.replace(/^[\s:\-–]+/, '').trim();
        model = model.replace(/^(downhillbike|mountainbike|fahrrad|bike)\s*/i, '').trim();
        if (!model) model = 'Model';

        return { brand, model, category };
    }

    checkIfNegotiable($) {
        const priceText = $('.boxedarticle--price, .price-element, .ad-price, #viewad-price').text();
        return priceText.includes('VB') || 
               priceText.toLowerCase().includes('verhandlungsbasis') || 
               priceText.toLowerCase().includes('verhandelbar');
    }

    extractDeliveryOption($, description = null) {
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
        // "+ Versand ab 4,89 Ã¢â€šÂ¬" -> Available
        // "Versand mÃƒÂ¶glich" -> Available
        if (/\bversand\s*(?:ab|m(?:oe|ö)glich)\b/i.test(cleanText) || /\+\s*versand/i.test(cleanText)) {
            return 'available';
        }

        // 2. Explicit Pickup Only
        if (/Nur\s*Abholung/i.test(cleanText) || /Kein\s*Versand/i.test(cleanText)) {
            return 'pickup-only';
        }

        // 3. Fallback: Check description
        const desc = description || this.extractDescription($);
        if (desc) {
            if (/\bversand\s*m(?:oe|ö)glich\b/i.test(desc) || /\bversand\s*gegen\s*aufpreis\b/i.test(desc)) {
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
        // ÃÂ£ÃÂ´ÃÂ°ÃÂ»Ã‘ÂÃÂµÃÂ¼ ÃÂ½ÃÂµÃÂ½Ã‘Æ’ÃÂ¶ÃÂ½Ã‘â€¹ÃÂµ Ã‘ÂÃÂ»ÃÂµÃÂ¼ÃÂµÃÂ½Ã‘â€šÃ‘â€¹ ÃÂ´ÃÂ»Ã‘Â Gemini
        $('script, style, nav, header, footer, .navigation, .menu, .sidebar').remove();
        $('.recommendations, .similar-ads, .related-ads, [class*="recommendation"]').remove();
        $('.advertisement, .ads, [class*="ad-"], [id*="ad-"]').remove();
        $('.cookie, .gdpr, .privacy, [class*="cookie"], [class*="gdpr"]').remove();
        
        // ÃËœÃÂ·ÃÂ²ÃÂ»ÃÂµÃÂºÃÂ°ÃÂµÃÂ¼ Ã‘â€šÃÂ¾ÃÂ»Ã‘Å’ÃÂºÃÂ¾ ÃÂ¾Ã‘ÂÃÂ½ÃÂ¾ÃÂ²ÃÂ½ÃÂ¾ÃÂ¹ ÃÂºÃÂ¾ÃÂ½Ã‘â€šÃÂµÃÂ½Ã‘â€š
        const mainContent = $('.boxedarticle, .ad-content, .main-content, main, article').first();
        
        if (mainContent.length > 0) {
            return mainContent.text().trim();
        }
        
        // Ãâ€¢Ã‘ÂÃÂ»ÃÂ¸ ÃÂ¾Ã‘ÂÃÂ½ÃÂ¾ÃÂ²ÃÂ½ÃÂ¾ÃÂ¹ ÃÂºÃÂ¾ÃÂ½Ã‘â€šÃÂµÃÂ½Ã‘â€š ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½, ÃÂ²ÃÂ¾ÃÂ·ÃÂ²Ã‘â‚¬ÃÂ°Ã‘â€°ÃÂ°ÃÂµÃÂ¼ ÃÂ¾Ã‘â€¡ÃÂ¸Ã‘â€°ÃÂµÃÂ½ÃÂ½Ã‘â€¹ÃÂ¹ body
        return $('body').text().trim().substring(0, 5000); // ÃÅ¾ÃÂ³Ã‘â‚¬ÃÂ°ÃÂ½ÃÂ¸Ã‘â€¡ÃÂ¸ÃÂ²ÃÂ°ÃÂµÃÂ¼ Ã‘â‚¬ÃÂ°ÃÂ·ÃÂ¼ÃÂµÃ‘â‚¬
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = KleinanzeigenParser;

