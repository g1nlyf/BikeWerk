const cheerio = require('cheerio');

/**
 * Kleinanzeigen Parser - ПРАВИЛЬНАЯ АРХИТЕКТУРА
 * 
 * Уровень 1: Прямые источники (meta, direct HTML)
 * Уровень 2: Блочные источники (attributes, price visual)
 * Уровень 3: Производные поля (из уровня 2)
 */
class KleinanzeigenParser {

  static parse(html, url) {
    const $ = cheerio.load(html);

    // === УРОВЕНЬ 0: ПРОВЕРКА КАТЕГОРИИ (АНТИ-МОПЕД ФИЛЬТР) ===
    const categoryInfo = this.extractCategoryBreadcrumb($);
    if (!this.isBicycleCategory(categoryInfo)) {
      console.log(`   🛑 [KleinanzeigenParser] Rejected: Not a bicycle category. Found: ${categoryInfo.raw}`);
      return {
        _rejected: true,
        _rejectReason: 'not_bicycle_category',
        _categoryFound: categoryInfo.raw,
        title: this.extractTitle($),
        ad_id: this.extractAdId($, url)
      };
    }

    // === УРОВЕНЬ 1: ПРЯМЫЕ ИСТОЧНИКИ ===
    const title = this.extractTitle($);
    const photos = this.extractPhotos($);
    const views_count = this.extractViewsCount($);
    const publish_date = this.extractPublishDate($);
    const location = this.extractLocation($);
    const description = this.extractDescription($);
    const ad_id = this.extractAdId($, url);

    // Seller block
    const seller_name = this.extractSellerName($);
    const seller_type = this.extractSellerType($);
    const seller_badges = this.extractSellerBadges($);
    const active_since = this.extractActiveSince($);

    // === УРОВЕНЬ 2: БЛОЧНЫЕ ИСТОЧНИКИ ===

    // 2.1 Price block (комплексный)
    const priceData = this.extractPriceBlock($);

    // 2.2 Attributes (KEY-VALUE таблица)
    const attributes = this.extractAttributesTable($);

    // === УРОВЕНЬ 3: ПРОИЗВОДНЫЕ ПОЛЯ ===
    const condition = attributes['Zustand'] || null;
    const bike_type = attributes['Art'] || null;
    const bike_category = attributes['Typ'] || null;
    const shipping_option = attributes['Versand'] || this.extractShippingFallback($);

    const brand = this.deriveBrand(title, attributes);
    const frame_size = this.deriveFrameSize(title, attributes, url, description);

    return {
      // Уровень 0
      category_breadcrumb: categoryInfo.breadcrumb,

      // Уровень 1
      title,
      ad_id,
      location,
      publish_date,
      description,
      photos,
      views_count,
      seller_name,
      seller_type,
      seller_badges,
      active_since,

      // Уровень 2
      price: priceData.price,
      old_price: priceData.old_price,
      shipping_option,
      attributes,

      // Уровень 3 (производные)
      condition,
      bike_type,
      bike_category,
      brand,
      frame_size
    };
  }

  // === УРОВЕНЬ 0: АНТИ-МОПЕД ФИЛЬТР ===

  static extractCategoryBreadcrumb($) {
    const result = {
      breadcrumb: [],
      raw: '',
      categoryId: null
    };

    try {
      // Breadcrumb селекторы
      const breadcrumbSelectors = [
        '#vap-brdcrmb a',
        '.breadcrump a',
        'nav.breadcrumbs a',
        '[itemtype*="BreadcrumbList"] a'
      ];

      for (const selector of breadcrumbSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href') || '';
            if (text && text.length > 0 && text.length < 50) {
              result.breadcrumb.push(text);
              // Извлекаем category ID из href (например, c217 = Fahrräder)
              const catMatch = href.match(/c(\d+)/);
              if (catMatch) {
                result.categoryId = catMatch[1];
              }
            }
          });
          break;
        }
      }

      result.raw = result.breadcrumb.join(' > ');

      // Fallback: проверяем URL страницы
      if (!result.categoryId) {
        const pageUrl = $('link[rel="canonical"]').attr('href') || '';
        const urlCatMatch = pageUrl.match(/c(\d+)/);
        if (urlCatMatch) {
          result.categoryId = urlCatMatch[1];
        }
      }

    } catch (e) {
      console.error('Error extracting category breadcrumb:', e.message);
    }

    return result;
  }

  static isBicycleCategory(categoryInfo) {
    // Разрешённые категории Kleinanzeigen
    const BICYCLE_CATEGORIES = ['217', '210', '211', '212', '213', '214', '215', '216'];
    // 217 = Fahrräder (главная)
    // 210+ = подкатегории велосипедов

    // Запрещённые слова в breadcrumb
    const FORBIDDEN_KEYWORDS = [
      'motorrad', 'moped', 'roller', 'scooter', 'mofa', 'simson',
      'vespa', 'yamaha', 'honda', 'kawasaki', 'suzuki', 'ktm motorrad',
      'e-scooter', 'elektroroller', 'motorroller', 'quad', 'atv'
    ];

    // Разрешённые слова (должны быть в breadcrumb для уверенности)
    const REQUIRED_KEYWORDS = ['fahrrad', 'fahrräder', 'bike', 'bicycle', 'rad'];

    // Проверка categoryId
    if (categoryInfo.categoryId) {
      if (BICYCLE_CATEGORIES.includes(categoryInfo.categoryId)) {
        return true;
      }
      // Если категория явно не велосипедная (например, 305 = Motorräder)
      if (['305', '306', '307'].includes(categoryInfo.categoryId)) {
        return false;
      }
    }

    // Проверка breadcrumb
    const rawLower = categoryInfo.raw.toLowerCase();

    // Если есть запрещённые слова — отклоняем
    for (const forbidden of FORBIDDEN_KEYWORDS) {
      if (rawLower.includes(forbidden)) {
        return false;
      }
    }

    // Если есть разрешённые слова — принимаем
    for (const required of REQUIRED_KEYWORDS) {
      if (rawLower.includes(required)) {
        return true;
      }
    }

    // Если breadcrumb пустой — даём шанс (fallback)
    if (categoryInfo.breadcrumb.length === 0) {
      console.log('   ⚠️ [KleinanzeigenParser] No breadcrumb found, allowing by default');
      return true;
    }

    // По умолчанию отклоняем неопознанные категории
    return false;
  }

  // ============================================================
  // УРОВЕНЬ 1: ПРЯМЫЕ ИСТОЧНИКИ
  // ============================================================

  static extractTitle($) {
    const selectors = ['#viewad-title', 'h1[itemprop="name"]'];
    return this.extractText($, selectors);
  }

  static extractViewsCount($) {
    // ПРЯМОЙ источник: #viewad-cntr-num
    const element = $('#viewad-cntr-num');
    if (element.length > 0) {
      const text = element.text().trim();
      const num = parseInt(text.replace(/\D/g, ''));
      return isNaN(num) ? null : num;
    }
    return null;
  }

  static extractPublishDate($) {
    const selectors = [
      'div#viewad-extra-info span',
      '[itemprop="datePublished"]'
    ];
    return this.extractText($, selectors);
  }

  static extractLocation($) {
    const selectors = ['#viewad-locality', '[itemprop="addressLocality"]'];
    return this.extractText($, selectors);
  }

  static extractDescription($) {
    const selectors = [
      '#viewad-description-text',
      'p.text-force-linebreak[itemprop="description"]'
    ];
    const desc = this.extractText($, selectors);
    return desc ? desc.replace(/\s+/g, ' ').trim() : null;
  }

  static extractPhotos($) {
    const photos = [];
    const images = $('div.galleryimage-element img');

    images.each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-imgsrc');
      if (src && src.startsWith('http') && !photos.includes(src)) {
        photos.push(src);
      }
    });

    return photos.length > 0 ? photos : null;
  }

  static extractAdId($, url) {
    // 1. Из URL (самый надежный)
    const urlMatch = url.match(/\/(\d+)-\d+-\d+$/);
    if (urlMatch) return urlMatch[1];

    // 2. Из sidebar
    const element = $('aside#viewad-sidebar li:contains("Anzeigen-ID") + li, .anzeigen-id');
    if (element.length > 0) {
      const text = element.text().trim();
      const match = text.match(/\d+/);
      if (match) return match[0];
    }

    return null;
  }

  // --- SELLER BLOCK ---

  static extractSellerName($) {
    const selectors = [
      'div#viewad-contact .userprofile-vip a',
      'aside#viewad-sidebar .userprofile-vip a'
    ];
    return this.extractText($, selectors);
  }

  static extractSellerType($) {
    const elements = $(
      'div#viewad-contact .userprofile-vip-details-text, ' +
      'aside#viewad-sidebar .userprofile-vip-details-text'
    );

    for (let i = 0; i < elements.length; i++) {
      const text = $(elements[i]).text().trim();
      if (text.includes('Privat') || text.includes('Gewerb')) {
        return text;
      }
    }
    return null;
  }

  static extractSellerBadges($) {
    const badges = [];
    const elements = $(
      'div#viewad-contact .userbadge-tag, ' +
      'aside#viewad-sidebar .userbadge-tag'
    );

    elements.each((i, el) => {
      const text = $(el).text().trim();
      if (text && !badges.includes(text)) {
        badges.push(text);
      }
    });

    return badges.length > 0 ? badges : null;
  }

  static extractActiveSince($) {
    const elements = $(
      'div#viewad-contact .userprofile-vip-details-text, ' +
      'aside#viewad-sidebar .userprofile-vip-details-text'
    );

    for (let i = 0; i < elements.length; i++) {
      const text = $(elements[i]).text().trim();
      if (text.includes('Aktiv seit')) {
        return text;
      }
    }
    return null;
  }

  // ============================================================
  // УРОВЕНЬ 2: БЛОЧНЫЕ ИСТОЧНИКИ
  // ============================================================

  /**
   * PRICE BLOCK - комплексный источник
   */
  static extractPriceBlock($) {
    const result = {
      price: null,
      old_price: null
    };

    // 1. Meta price (чистое число)
    const metaPrice = $('meta[itemprop="price"]').attr('content');
    const value = metaPrice ? parseFloat(metaPrice) : null;

    // 2. Visual price (для VB)
    const priceText = this.extractText($, [
      'h2.boxedarticle--price',
      '.boxedarticle--price'
    ]);

    const isNegotiable = priceText ? priceText.includes('VB') : false;

    if (value) {
      result.price = {
        raw: priceText || metaPrice,
        value: value,
        currency: 'EUR',
        is_negotiable: isNegotiable
      };
    }

    // 3. Old price (отдельный элемент)
    const oldPriceText = this.extractText($, [
      '.boxedarticle-old-price',
      'p.boxedarticle-old-price'
    ]);

    if (oldPriceText) {
      const cleanPrice = oldPriceText.replace(/[^\d,]/g, '').replace(',', '.');
      result.old_price = parseFloat(cleanPrice) || null;
    }

    return result;
  }

  /**
   * ATTRIBUTES TABLE - ИСПРАВЛЕННАЯ ВЕРСИЯ
   * 
   * ПРОБЛЕМА: <li> элементы БЕЗ родительского <ul>!
   * Структура: <div class="addetailslist"><li>...</li></div>
   */
  static extractAttributesTable($) {
    console.log('\n🔍 DEBUG: Extracting attributes table...');

    const attributes = {};

    // DEBUG
    console.log('   Checking page structure:');
    console.log(`   - .addetailslist: ${$('.addetailslist').length}`);
    console.log(`   - li.addetailslist--detail: ${$('li.addetailslist--detail').length}`);
    console.log(`   - #viewad-details: ${$('#viewad-details').length}`);

    // Проверим что внутри #viewad-details
    const detailsSection = $('#viewad-details');
    if (detailsSection.length > 0) {
      console.log('\n   Found #viewad-details section');
      const htmlSnippet = detailsSection.html()?.substring(0, 500);
      console.log(`   HTML snippet: ${htmlSnippet}...`);
    }

    // ПРАВИЛЬНЫЙ ПОДХОД: Искать все li с классом addetailslist--detail
    // Они могут быть где угодно (не обязательно в ul)
    const listItems = $('li.addetailslist--detail');
    console.log(`\n   Found li.addetailslist--detail: ${listItems.length} items`);

    if (listItems.length > 0) {
      listItems.each((i, el) => {
        const $el = $(el);

        // Структура: <li>Art<span class="addetailslist--detail--value">Herren</span></li>
        const fullText = $el.text().trim();

        // Способ 1: Найти span с value
        const valueSpan = $el.find('span.addetailslist--detail--value, .addetailslist--detail--value');

        let key, value;

        if (valueSpan.length > 0) {
          value = valueSpan.text().trim();
          // Ключ = весь текст минус значение
          key = fullText.replace(value, '').trim();
        } else {
          // Способ 2: Найти любой span
          const anySpan = $el.find('span').first();
          if (anySpan.length > 0) {
            value = anySpan.text().trim();
            key = fullText.replace(value, '').trim();
          }
        }

        if (i < 5) {
          console.log(`     Item ${i}: fullText="${fullText}"`);
          console.log(`              key="${key}", value="${value}"`);
        }

        if (key && value) {
          attributes[key] = value;
        }
      });
    }

    // FALLBACK: Попробовать через .addetailslist div
    if (Object.keys(attributes).length === 0) {
      console.log('\n   Trying fallback: .addetailslist direct children');

      const container = $('.addetailslist').first();
      if (container.length > 0) {
        const children = container.children('li');
        console.log(`   Found ${children.length} direct li children`);

        children.each((i, el) => {
          const $el = $(el);
          const fullText = $el.text().trim();
          const span = $el.find('span').first();

          if (span.length > 0) {
            const value = span.text().trim();
            const key = fullText.replace(value, '').trim();

            if (key && value) {
              attributes[key] = value;
            }
          }
        });
      }
    }

    console.log(`\n📋 Total attributes extracted: ${Object.keys(attributes).length}`);
    if (Object.keys(attributes).length > 0) {
      console.log(`   ${JSON.stringify(attributes, null, 2)}\n`);
    } else {
      console.log('   ❌ NO ATTRIBUTES FOUND!\n');
    }

    return attributes;
  }

  static extractShippingFallback($) {
    const selectors = [
      'span.boxedarticle--details--shipping',
      '.boxedarticle--details--shipping'
    ];
    return this.extractText($, selectors);
  }

  // ============================================================
  // УРОВЕНЬ 3: ПРОИЗВОДНЫЕ ПОЛЯ
  // ============================================================

  static deriveBrand(title, attributes) {
    if (attributes['Marke']) return attributes['Marke'];

    if (title) {
      const brands = [
        'Canyon', 'Specialized', 'Trek', 'Giant', 'Scott', 'Cube', 'Rose',
        'Focus', 'Bulls', 'Haibike', 'KTM', 'Merida', 'Cannondale', 'BMC',
        'Santa Cruz', 'YT', 'Radon', 'Stevens', 'Ghost', 'Conway'
      ];

      const found = brands.find(brand =>
        title.toLowerCase().includes(brand.toLowerCase())
      );

      if (found) return found;
    }

    return null;
  }

  static deriveFrameSize(title, attributes, url = null, description = null) {
    // Priority 1: Extract from TITLE (most reliable for Kleinanzeigen)
    if (title) {
      // Pattern: "Specialized Demo 8 Carbon S Works XL" -> XL
      // Look for size at end of title or after model name
      const titlePatterns = [
        /\b(XXS|XS|S|M|L|XL|XXL)\s*$/i,                    // Size at end
        /\b(XXS|XS|S|M|L|XL|XXL)\b(?=\s*[-\/]|\s*$)/i,    // Size before dash/slash/end
        /\bGröße\s*[:=]?\s*(XXS|XS|S|M|L|XL|XXL|\d{2})\b/i, // "Größe: L"
        /\bSize\s*[:=]?\s*(XXS|XS|S|M|L|XL|XXL|\d{2})\b/i,  // "Size: L"
        /\bRH\s*[:=]?\s*(\d{2})\b/i,                        // "RH: 54"
        /\b(\d{2})\s*(?:cm|zoll)?\s*(?:Rahmen|frame)?\b/i   // "54cm"
      ];

      for (const pattern of titlePatterns) {
        const match = title.match(pattern);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }

    // Priority 2: Extract from URL (often contains size)
    if (url) {
      const urlLower = url.toLowerCase();
      const urlPatterns = [
        /-(xxs|xs|s|m|l|xl|xxl)-/i,
        /-(xxs|xs|s|m|l|xl|xxl)\//i,
        /[\/-](xxs|xs|s|m|l|xl|xxl)$/i
      ];

      for (const pattern of urlPatterns) {
        const match = urlLower.match(pattern);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }

    // Priority 3: Extract from attributes table
    for (const [key, value] of Object.entries(attributes)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('rahmengröße') || lowerKey === 'größe' || lowerKey.includes('size')) {
        // Normalize the value
        const normalized = value.trim().toUpperCase();
        if (/^(XXS|XS|S|M|L|XL|XXL|\d{2})$/.test(normalized)) {
          return normalized;
        }
        // Try to extract from value like "L (52-54cm)"
        const sizeMatch = value.match(/\b(XXS|XS|S|M|L|XL|XXL)\b/i);
        if (sizeMatch) return sizeMatch[1].toUpperCase();
      }
    }

    // Priority 4: Extract from description
    if (description) {
      const descPatterns = [
        /Rahmengröße\s*[:=]?\s*(XXS|XS|S|M|L|XL|XXL|\d{2})/i,
        /Rahmen\s*[:=]?\s*(XXS|XS|S|M|L|XL|XXL|\d{2})/i,
        /Size\s*[:=]?\s*(XXS|XS|S|M|L|XL|XXL|\d{2})/i
      ];

      for (const pattern of descPatterns) {
        const match = description.match(pattern);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }

    return null;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  static extractText($, selectors) {
    for (const selector of selectors) {
      try {
        const element = $(selector);
        if (element.length > 0) {
          const text = element.first().text().trim();
          if (text) return text;
        }
      } catch (e) { }
    }
    return null;
  }

  static validate(data) {
    const errors = [];
    const warnings = [];

    if (!data.title) errors.push('Missing title');
    if (!data.price) errors.push('Missing price');
    if (!data.ad_id) warnings.push('Missing ad_id');
    if (!data.location) warnings.push('Missing location');

    if (!data.photos || data.photos.length === 0) {
      warnings.push('No photos found');
    }

    if (!data.description || data.description.length < 50) {
      warnings.push('Description too short or missing');
    }

    if (!data.attributes || Object.keys(data.attributes).length === 0) {
      warnings.push('No attributes extracted (condition, bike_type, bike_category will be null)');
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = KleinanzeigenParser;
