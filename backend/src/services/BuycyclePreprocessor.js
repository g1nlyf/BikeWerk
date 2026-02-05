const cheerio = require('cheerio');

class BuycyclePreprocessor {
    preprocess(rawData = {}) {
        if (rawData.html) {
            return this.preprocessHtml(rawData);
        }
        return this.preprocessObject(rawData);
    }

    preprocessHtml(rawData) {
        const html = rawData.html || '';
        const $ = cheerio.load(html);
        const nextData = this.extractNextData($);
        const product = this.resolveProduct(nextData) || {};

        const title = product.title || this.extractTitle($) || rawData.title;
        const price = this.normalizePrice(product.price?.value ?? product.price?.amount ?? product.price) ?? this.normalizePrice(this.extractPrice($)) ?? rawData.price;
        const originalPrice = this.normalizePrice(product.originalPrice?.value ?? product.originalPrice?.amount ?? product.originalPrice) ?? rawData.original_price;
        const year = product.year || this.extractYearFromText(title) || rawData.year;
        const frameSize = product.frameSize || product.frame_size || rawData.frame_size;
        const condition = product.condition || rawData.condition;
        const description = product.description || this.extractDescription($) || rawData.description;
        const images = this.mergeImages(product.images, this.extractImages($), rawData.images || rawData.image);

        const generalInfo = this.extractInfoChips($);
        const components = {
            ...(product.components || {}),
            ...this.extractComponentsFromNextData(nextData || product),
            ...this.extractComponents($)
        };

        const conditionLabel = condition || generalInfo?.Zustand || generalInfo?.zustand;
        const conditionStatus = this.mapConditionStatus(conditionLabel);

        return {
            title,
            description,
            price,
            original_price: originalPrice,
            year,
            frame_size: frameSize || generalInfo?.Rahmengröße || generalInfo?.rahmengröße,
            condition: conditionLabel,
            condition_status: conditionStatus,
            components,
            general_info: generalInfo,
            images,
            url: rawData.url,
            source_platform: 'buycycle',
            source_ad_id: rawData.external_id || rawData.id || product.id || product.slug
        };
    }

    preprocessObject(rawData) {
        const images = this.mergeImages(rawData.images, [], rawData.image);
        const conditionStatus = this.mapConditionStatus(rawData.condition);
        return {
            title: rawData.title,
            description: rawData.description,
            price: this.normalizePrice(rawData.price),
            original_price: this.normalizePrice(rawData.original_price),
            year: rawData.year,
            frame_size: rawData.frame_size,
            condition: rawData.condition,
            condition_status: conditionStatus,
            components: rawData.components || {},
            general_info: rawData.general_info || rawData.general || {},
            images,
            url: rawData.url,
            source_platform: 'buycycle',
            source_ad_id: rawData.external_id || rawData.id,
            seller: rawData.seller || {}
        };
    }

    extractNextData($) {
        // 1. Try standard __NEXT_DATA__
        const script = $('#__NEXT_DATA__').html();
        if (script) {
            try {
                return JSON.parse(script);
            } catch (e) {}
        }

        // 2. Try App Router self.__next_f
        // Collect all chunks
        let stream = '';
        $('script').each((i, el) => {
            const content = $(el).html() || '';
            if (content.includes('self.__next_f.push')) {
                const match = content.match(/self\.__next_f\.push\(\[\d+,"(.*)"\]\)/);
                if (match && match[1]) {
                    try {
                        const chunk = JSON.parse(`"${match[1]}"`);
                        stream += chunk;
                    } catch (e) {
                        // Fallback if parse fails
                    }
                }
            }
        });

        if (stream) {
            // Mock a "NextData" object with extracted fields
            const extracted = {
                props: {
                    pageProps: {
                        product: {
                            components: {}
                        }
                    }
                }
            };
            const product = extracted.props.pageProps.product;

            // Description
            const descMatch = stream.match(/"description":\{"key":"[^"]+","value":"(.*?)"/);
            if (descMatch && descMatch[1]) {
                product.description = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }

            // Attributes / Components
            const attrRegex = /{"key":"(.*?)","value":"(.*?)"(?:,"url":.*?)?}/g;
            let match;
            while ((match = attrRegex.exec(stream)) !== null) {
                const key = match[1];
                let val = match[2];
                val = val.replace(/\\"/g, '"');
                
                if (key && val) {
                    if (key === 'component_name') product.components['Groupset'] = val;
                    else if (key === 'frame_material_name') product.components['Frame Material'] = val;
                    else if (key === 'brake_type_name') product.components['Brakes'] = val;
                    else if (key === 'year') product.year = parseInt(val);
                    else if (key === 'frame_size_string') product.frameSize = val;
                    else product.components[key] = val;
                }
            }
            
            // General Info (Zustand, etc.)
            const generalRegex = /{"key":"(.*?)","value":"(.*?)"/g;
            while ((match = generalRegex.exec(stream)) !== null) {
                 const key = match[1];
                 const val = match[2];
                 if (key === 'Zustand') product.condition = val;
            }

            return extracted;
        }

        return null;
    }

    resolveProduct(nextData) {
        if (!nextData) return null;
        const pageProduct = nextData?.props?.pageProps?.product;
        if (pageProduct) return pageProduct;
        const altProduct = nextData?.props?.pageProps?.initialState?.product;
        if (altProduct) return altProduct;
        return this.findProductNode(nextData);
    }

    findProductNode(node) {
        if (!node || typeof node !== 'object') return null;
        if (node.title && node.price && node.images) return node;
        for (const key of Object.keys(node)) {
            const found = this.findProductNode(node[key]);
            if (found) return found;
        }
        return null;
    }

    extractTitle($) {
        const title = $('h1').first().text().trim();
        return title || null;
    }

    extractPrice($) {
        // 1. Try common price classes
        let priceText = $('[class*="Price"], [class*="price"]').first().text().trim();
        
        // 2. Look for currency symbols if class search failed or returned empty
        if (!priceText || !this.normalizePrice(priceText)) {
            const currencyElements = $('*:contains("€"), *:contains("EUR")').filter((i, el) => {
                const text = $(el).text().trim();
                // Check if it looks like a price (e.g. "1.200 €" or "€ 1200")
                return /^\s*(?:€|EUR)?\s*[\d.,]+\s*(?:€|EUR)?\s*$/.test(text) && $(el).children().length === 0;
            });
            
            if (currencyElements.length > 0) {
                priceText = currencyElements.first().text().trim();
            }
        }

        // 3. Look in meta tags
        if (!priceText || !this.normalizePrice(priceText)) {
            priceText = $('meta[property="product:price:amount"]').attr('content') || 
                        $('meta[name="price"]').attr('content');
        }

        return priceText || null;
    }

    extractDescription($) {
        const desc = $('[class*="escription"]').first().text().trim();
        return desc || null;
    }

    extractYearFromText(text) {
        if (!text) return null;
        const match = text.match(/\b(20\d{2})\b/);
        return match ? parseInt(match[1]) : null;
    }

    extractInfoChips($) {
        const info = {};
        $('dl').each((i, el) => {
            const dt = $(el).find('dt').text().trim();
            const dd = $(el).find('dd').text().trim();
            if (dt && dd) info[dt] = dd;
        });
        return Object.keys(info).length > 0 ? info : {};
    }

    extractComponents($) {
        const components = {};
        const addEntry = (label, value) => {
            if (!label || !value || label === value) return;
            // Clean up label
            label = label.replace(/:$/, '').trim();
            components[label] = value;
        };

        const parseTable = (root) => {
            root.find('tr').each((i, el) => {
                const tds = $(el).find('td');
                if (tds.length >= 2) {
                    const label = $(tds[0]).text().trim();
                    const value = $(tds[1]).text().trim();
                    addEntry(label, value);
                }
            });
        };

        const parseDl = (root) => {
            root.find('dl').each((i, el) => {
                const label = $(el).find('dt').text().trim();
                const value = $(el).find('dd').text().trim();
                addEntry(label, value);
            });
        };

        // 1. Try known section headings
        const headings = $('h1, h2, h3, h4, h5').filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes('fahrraddetails') || text.includes('komponenten') || text.includes('components') || text.includes('ausstattung') || text.includes('details');
        });
        
        headings.each((i, el) => {
            const section = $(el).closest('section, div');
            parseTable(section);
            parseDl(section);
            // Also look for sibling div if the heading is standalone
            const sibling = $(el).next('div, section');
            if (sibling.length) {
                parseTable(sibling);
                parseDl(sibling);
            }
        });

        // 2. Try known class names
        $('[data-testid*="component"], [data-testid*="spec"], [class*="Fahrraddetails"], [class*="Component"], [class*="Specification"]').each((i, el) => {
            const section = $(el);
            parseTable(section);
            parseDl(section);
        });

        // 3. Fallback: Scan ALL tables for component-like content
        // If we found nothing or very few components, try this aggressive approach
        if (Object.keys(components).length < 3) {
            $('table').each((i, table) => {
                let score = 0;
                const rows = $(table).find('tr');
                rows.each((j, row) => {
                    const text = $(row).text().toLowerCase();
                    if (text.includes('shimano') || text.includes('sram') || text.includes('rockshox') || text.includes('fox') || text.includes('frame') || text.includes('gabel') || text.includes('bremse')) {
                        score++;
                    }
                });
                
                // If this table looks like it has bike parts, parse it
                if (score >= 1) {
                    parseTable($(table));
                }
            });
        }

        // 4. Last resort: Parse simple list items if they look like "Key: Value"
        if (Object.keys(components).length < 3) {
            $('li').each((i, el) => {
                const text = $(el).text();
                const parts = text.split(':');
                if (parts.length === 2) {
                    addEntry(parts[0].trim(), parts[1].trim());
                }
            });
        }

        return components;
    }

    extractImages($) {
        const images = new Set();
        $('img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http') && !this.isInvalidImage(src)) images.add(src);
            const srcset = $(el).attr('srcset');
            if (srcset) {
                const parts = srcset.split(',').map(p => p.trim().split(' ')[0]);
                parts.forEach(p => {
                    if (p && p.startsWith('http') && !this.isInvalidImage(p)) images.add(p);
                });
            }
        });
        return Array.from(images);
    }

    mergeImages(productImages, htmlImages, fallbackImages) {
        const list = [];
        const pushImage = (img) => {
            if (!img) return;
            const url = typeof img === 'string' ? img : img.url;
            if (url && !this.isInvalidImage(url)) list.push(url);
        };
        if (Array.isArray(productImages)) productImages.forEach(pushImage);
        if (Array.isArray(htmlImages)) htmlImages.forEach(pushImage);
        if (Array.isArray(fallbackImages)) fallbackImages.forEach(pushImage);
        if (typeof fallbackImages === 'string') pushImage(fallbackImages);
        return Array.from(new Set(list));
    }

    extractComponentsFromNextData(product) {
        const components = {};
        const addEntry = (label, value) => {
            if (!label || !value || label === value) return;
            components[label] = value;
        };
        const handleArray = (items) => {
            items.forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const label = item.label || item.name || item.key || item.title;
                const value = item.value || item.text || item.description;
                addEntry(label, value);
            });
        };
        const handleObject = (obj) => {
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'string' || typeof value === 'number') {
                    addEntry(key, String(value));
                }
            });
        };
        const scan = (node, depth = 0) => {
            if (!node || depth > 6) return;
            if (Array.isArray(node)) {
                handleArray(node);
                node.forEach((child) => scan(child, depth + 1));
                return;
            }
            if (typeof node !== 'object') return;
            const keys = Object.keys(node);
            for (const key of keys) {
                const value = node[key];
                const lowerKey = key.toLowerCase();
                if (['components', 'component', 'specs', 'specifications', 'details', 'bikedetails', 'bike_details', 'equipment', 'parts'].includes(lowerKey)) {
                    if (Array.isArray(value)) handleArray(value);
                    else if (typeof value === 'object') handleObject(value);
                }
                scan(value, depth + 1);
            }
        };
        scan(product);
        return components;
    }

    normalizePrice(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return value;
        
        let str = String(value).trim();
        
        // Remove currency symbols and spaces
        // Keep only digits, dots, commas
        str = str.replace(/[^\d.,]/g, '');
        
        if (!str) return null;

        // Detect format
        // If contains both . and ,
        if (str.includes('.') && str.includes(',')) {
            // German format: 1.200,00 -> last separator is comma
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                // US format: 1,200.00
                str = str.replace(/,/g, '');
            }
        } 
        // If contains only .
        else if (str.includes('.')) {
            // If multiple dots, it's definitely thousands: 1.200.000
            if ((str.match(/\./g) || []).length > 1) {
                str = str.replace(/\./g, '');
            }
            // If one dot, check if it's thousands or decimal
            else {
                const parts = str.split('.');
                // If 3 digits after dot, assume thousands (e.g. 1.200) unless it's small number
                // But wait, 1.200 can be 1.2 (rare in prices). 
                // In bike context, 1.200 is 1200. 1.2 is unlikely.
                if (parts[1].length === 3) {
                    str = str.replace('.', '');
                }
                // Otherwise assume decimal (12.50)
            }
        }
        // If contains only ,
        else if (str.includes(',')) {
             // German decimal: 1200,50 -> 1200.50
             str = str.replace(',', '.');
        }

        const num = parseFloat(str);
        return Number.isFinite(num) ? num : null;
    }

    mapConditionStatus(label) {
        if (!label) return null;
        const text = label.toLowerCase();
        if (text.includes('sehr gut')) return 'very_good';
        if (text.includes('wie neu') || text.includes('neu')) return 'new';
        return 'used';
    }

    isInvalidImage(url) {
        const lower = String(url).toLowerCase();
        if (!lower) return true;
        if (lower.includes('.svg')) return true;
        if (lower.includes('/icons/')) return true;
        if (lower.includes('/icon/')) return true;
        if (lower.includes('placeholder')) return true;
        if (lower.includes('buycyclebwhite')) return true;
        if (lower.includes('logo')) return true;
        const sizeMatches = lower.match(/[?&](w|width|h|height)=([0-9]{1,4})/g) || [];
        const sizes = sizeMatches.map(match => parseInt(match.split('=')[1], 10)).filter(Number.isFinite);
        if (sizes.length > 0 && Math.max(...sizes) < 100) return true;
        const dimMatch = lower.match(/(\d{2,3})x(\d{2,3})/);
        if (dimMatch) {
            const w = parseInt(dimMatch[1], 10);
            const h = parseInt(dimMatch[2], 10);
            if (w < 100 && h < 100) return true;
        }
        return false;
    }
}

module.exports = new BuycyclePreprocessor();
