/**
 * UrlExtractor - Умное извлечение URL из текстовых сообщений
 * Поддерживает: Kleinanzeigen, eBay, Mobile.de, Buycycle и другие платформы
 */

class UrlExtractor {
    constructor() {
        // Паттерны для различных платформ
        this.patterns = {
            kleinanzeigen: /https?:\/\/(www\.)?kleinanzeigen\.de\/s-anzeige\/[^\s]+/gi,
            ebay: /https?:\/\/(www\.)?ebay-kleinanzeigen\.de\/[^\s]+|https?:\/\/(www\.)?ebay\.de\/itm\/[^\s]+/gi,
            mobile_de: /https?:\/\/(www\.)?mobile\.de\/[^\s]+/gi,
            buycycle: /https?:\/\/(www\.)?buycycle\.com\/[^\s]+/gi,
            autoscout24: /https?:\/\/(www\.)?autoscout24\.de\/[^\s]+/gi,
        };

        // Универсальный паттерн для любого URL
        this.genericUrlPattern = /https?:\/\/[^\s]+/gi;
    }

    /**
     * Извлечь все URL из сообщения
     * @param {string} message 
     * @returns {Array<{url: string, source: string}>}
     */
    extractUrls(message) {
        if (!message || typeof message !== 'string') {
            return [];
        }

        const found = [];
        const seenUrls = new Set();

        // Пробуем специфичные паттерны
        for (const [source, pattern] of Object.entries(this.patterns)) {
            const matches = message.match(pattern);
            if (matches) {
                matches.forEach(url => {
                    const cleaned = this.cleanUrl(url);
                    if (!seenUrls.has(cleaned)) {
                        seenUrls.add(cleaned);
                        found.push({ url: cleaned, source });
                    }
                });
            }
        }

        // Если ничего не нашли, пробуем универсальный паттерн
        if (found.length === 0) {
            const matches = message.match(this.genericUrlPattern);
            if (matches) {
                matches.forEach(url => {
                    const cleaned = this.cleanUrl(url);
                    if (!seenUrls.has(cleaned)) {
                        seenUrls.add(cleaned);
                        const detectedSource = this.detectSource(cleaned);
                        found.push({ url: cleaned, source: detectedSource });
                    }
                });
            }
        }

        return found;
    }

    /**
     * Очистить URL от tracking параметров
     * @param {string} url 
     * @returns {string}
     */
    cleanUrl(url) {
        try {
            const urlObj = new URL(url);

            // Удаляем распространенные tracking параметры
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid'
            ];

            trackingParams.forEach(param => {
                urlObj.searchParams.delete(param);
            });

            return urlObj.toString();
        } catch (e) {
            // Если URL невалидный, возвращаем как есть
            return url;
        }
    }

    /**
     * Определить источник по URL
     * @param {string} url 
     * @returns {string}
     */
    detectSource(url) {
        const lower = url.toLowerCase();

        if (lower.includes('kleinanzeigen.de')) return 'kleinanzeigen';
        if (lower.includes('ebay-kleinanzeigen.de')) return 'kleinanzeigen';
        if (lower.includes('ebay.de')) return 'ebay';
        if (lower.includes('mobile.de')) return 'mobile.de';
        if (lower.includes('buycycle.com')) return 'buycycle';
        if (lower.includes('autoscout24.de')) return 'autoscout24';

        return 'unknown';
    }

    /**
     * Извлечь первый URL из сообщения
     * @param {string} message 
     * @returns {{url: string, source: string} | null}
     */
    extractFirstUrl(message) {
        const urls = this.extractUrls(message);
        return urls.length > 0 ? urls[0] : null;
    }

    /**
     * Проверить, содержит ли сообщение URL
     * @param {string} message 
     * @returns {boolean}
     */
    hasUrl(message) {
        return this.extractUrls(message).length > 0;
    }
}

module.exports = new UrlExtractor();
