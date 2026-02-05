const cheerio = require('cheerio');

class KleinanzeigenPreprocessor {
    preprocess(rawData = {}) {
        if (rawData.html) {
            return this.preprocessHtml(rawData);
        }
        return this.preprocessObject(rawData);
    }

    preprocessHtml(rawData) {
        const html = rawData.html || '';
        const $ = cheerio.load(html);
        const title = this.extractTitle($) || rawData.title;
        const description = this.extractDescription($) || rawData.description;
        const price = this.normalizePrice(this.extractPrice($)) ?? this.normalizePrice(rawData.price);
        const location = this.extractLocation($) || rawData.location;
        const seller = this.extractSeller($, rawData);
        const images = this.extractImages($, rawData.images || rawData.image);
        const sourceAdId = this.extractAdId($, html, rawData.url, rawData.external_id || rawData.id);
        const attributes = this.extractAttributes($);

        return {
            title,
            description,
            price,
            location,
            seller,
            seller_type: seller?.type || rawData.seller_type,
            images,
            url: rawData.url,
            source_platform: 'kleinanzeigen',
            source_ad_id: sourceAdId,
            general_info: attributes || {}
        };
    }

    extractAttributes($) {
        if (!$) return {};
        const attributes = {};
        
        // Kleinanzeigen usually has a dl/dd structure or ul/li for details
        // Try to find the details list
        $('#viewad-details .addetailslist li').each((i, el) => {
            const text = $(el).text().trim();
            // Format is usually "Key: Value" or just "Value" depending on the item
            // Sometimes it's structured as spans
            // Let's try to split by first colon
            const parts = text.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                if (key && value) {
                    attributes[key] = value;
                }
            } else {
                // If no colon, maybe it's a tag or category
                attributes[`tag_${i}`] = text;
            }
        });

        // Also check for structured data in description if any (less likely)
        
        return attributes;
    }

    preprocessObject(rawData) {
        const images = this.extractImages(null, rawData.images || rawData.image || rawData.gallery);
        return {
            title: rawData.title,
            description: rawData.description,
            price: this.normalizePrice(rawData.price),
            location: rawData.location,
            seller: rawData.seller || {
                name: rawData.seller_name || rawData.sellerName || null,
                type: rawData.seller_type || rawData.sellerType || null
            },
            seller_type: rawData.seller_type || rawData.sellerType || null,
            images,
            url: rawData.url,
            source_platform: 'kleinanzeigen',
            source_ad_id: rawData.external_id || rawData.id,
            general_info: rawData.attributes || rawData.specs || {}
        };
    }

    extractTitle($) {
        if (!$) return null;
        const title = $('#viewad-title').text().trim()
            || $('.viewad-title').text().trim()
            || $('h1').first().text().trim();
        return title || null;
    }

    extractPrice($) {
        if (!$) return null;
        const priceText = $('#viewad-price').text().trim()
            || $('[class*="price"]').first().text().trim()
            || $('[data-testid*="price"]').text().trim();
        return priceText || null;
    }

    extractLocation($) {
        if (!$) return null;
        const location = $('#viewad-locality').text().trim()
            || $('.viewad-locality').text().trim()
            || $('[data-testid="ad-location"]').text().trim();
        return location || null;
    }

    extractDescription($) {
        if (!$) return null;
        const desc = $('#viewad-description-text').text().trim()
            || $('#viewad-description').text().trim()
            || $('.viewad-description').text().trim();
        return desc || null;
    }

    extractSeller($, rawData) {
        if (!$) {
            return {
                name: rawData.seller_name || rawData.sellerName || null,
                type: rawData.seller_type || rawData.sellerType || null
            };
        }
        const sellerName = $('.profile-box__name').text().trim()
            || $('.text--title').first().text().trim()
            || $('#viewad-contact').find('a').first().text().trim();
        const sellerText = $('#viewad-contact').text().toLowerCase();
        const sellerType = this.mapSellerType(sellerText || $('body').text().toLowerCase());
        return {
            name: sellerName || null,
            type: sellerType
        };
    }

    mapSellerType(text) {
        if (!text) return null;
        if (text.includes('gewerblich') || text.includes('anbieter')) return 'commercial';
        if (text.includes('privat')) return 'private';
        return null;
    }

    extractImages($, fallbackImages) {
        const images = new Set();
        const seenIds = new Set();

        const pushImage = (value) => {
            if (!value) return;
            const url = String(value);
            if (!url.startsWith('http') || this.isSvg(url)) return;
            
            // Deduplicate by Kleinanzeigen UUID if possible
            // Format: .../images/{shard}/{uuid}?rule=...
            // e.g. .../images/6e/6ea44399-9e00-4031-9875-238d8ecf19d2?rule=$_59.AUTO
            const match = url.match(/\/([a-f0-9-]{36})/);
            if (match) {
                const uuid = match[1];
                if (seenIds.has(uuid)) return;
                seenIds.add(uuid);
            }
            
            // Prefer high-res rule if available
            // If the URL has a rule parameter, we might want to force it to $_59.AUTO (High Res)
            let highResUrl = url;
            if (url.includes('kleinanzeigen.de') && url.includes('rule=')) {
                highResUrl = url.replace(/rule=\$_(\d+)\.(.+)$/, 'rule=$_59.AUTO');
            }

            images.add(highResUrl);
        };

        if ($) {
            // Target the main gallery specifically if possible
            const galleryImages = $('#viewad-image, .gallery-image, .imagebox, .ad-image');
            
            if (galleryImages.length > 0) {
                galleryImages.each((i, el) => {
                    pushImage($(el).attr('data-imgsrc'));
                    pushImage($(el).attr('data-src'));
                    pushImage($(el).attr('src'));
                     const srcset = $(el).attr('srcset');
                    if (srcset) {
                        srcset.split(',').forEach(part => {
                            const url = part.trim().split(' ')[0];
                            pushImage(url);
                        });
                    }
                });
            } else {
                 // Fallback to all images if gallery structure not found
                 $('img').each((i, el) => {
                    pushImage($(el).attr('data-imgsrc'));
                    pushImage($(el).attr('data-src'));
                    pushImage($(el).attr('src'));
                });
            }
        }
        
        if (Array.isArray(fallbackImages)) fallbackImages.forEach(pushImage);
        if (typeof fallbackImages === 'string') pushImage(fallbackImages);
        return Array.from(images);
    }

    extractAdId($, html, url, fallback) {
        if ($) {
            const dataId = $('[data-adid]').attr('data-adid');
            if (dataId) return dataId;
            const viewAdId = $('#viewad-ad-id').text().trim();
            if (viewAdId) return viewAdId;
        }
        const match = html ? html.match(/data-adid=["'](\d+)["']/) : null;
        if (match) return match[1];
        if (url) {
            const urlMatch = url.match(/\/(\d+)-/);
            if (urlMatch) return urlMatch[1];
        }
        return fallback || null;
    }

    normalizePrice(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return value;
        let cleaned = String(value).replace(/[^0-9.,]/g, '');
        if (cleaned.includes('.') && !cleaned.includes(',')) {
            if (/\d+\.\d{3}\b/.test(cleaned)) {
                cleaned = cleaned.replace(/\./g, '');
            }
        }
        if (cleaned.includes(',') && cleaned.includes('.')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            cleaned = cleaned.replace(',', '.');
        }
        const num = parseFloat(cleaned);
        return Number.isFinite(num) ? num : null;
    }

    isSvg(url) {
        const lower = String(url).toLowerCase();
        return lower.includes('.svg') || lower.includes('icon');
    }
}

module.exports = new KleinanzeigenPreprocessor();
