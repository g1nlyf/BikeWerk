const cheerio = require('cheerio');

/**
 * АВТОМАТИЧЕСКИЙ ПОИСК СЕЛЕКТОРОВ
 */
class SelectorFinder {
  
  static findSelectors(html, searchMap) {
    const $ = cheerio.load(html);
    const results = {};
    
    console.log('\n🔍 АВТОМАТИЧЕСКИЙ ПОИСК СЕЛЕКТОРОВ\n');
    console.log('='.repeat(80));
    
    for (const [fieldName, searchValue] of Object.entries(searchMap)) {
      console.log(`\n📌 Ищем: ${fieldName} = "${searchValue}"`);
      
      const result = this.findElementByText($, searchValue, fieldName);
      results[fieldName] = result;
      
      if (result.found) {
        console.log(`   ✅ НАЙДЕНО!`);
        console.log(`   Селектор: ${result.selector}`);
        console.log(`   Путь: ${result.path}`);
      } else {
        console.log(`   ❌ НЕ НАЙДЕНО`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    return results;
  }
  
  static findElementByText($, searchText, fieldName) {
    const normalizedSearch = searchText.trim().replace(/\s+/g, ' ');
    
    let foundElement = null;
    let foundSelector = null;
    let foundPath = null;
    
    $('*').each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim().replace(/\s+/g, ' ');
      
      if (text === normalizedSearch) {
        foundElement = el;
        foundSelector = this.generateSelector($, el);
        foundPath = this.generatePath($, el);
        return false;
      }
      
      if (!foundElement && text.includes(normalizedSearch)) {
        foundElement = el;
        foundSelector = this.generateSelector($, el);
        foundPath = this.generatePath($, el);
      }
    });
    
    if (!foundElement) {
      return { found: false, selector: null, path: null, html: null };
    }
    
    const parent = $(foundElement).parent();
    const parentText = parent.text().trim();
    const isKeyValue = parentText !== $(foundElement).text().trim();
    
    return {
      found: true,
      selector: foundSelector,
      path: foundPath,
      html: $.html(foundElement).substring(0, 200),
      isKeyValue: isKeyValue,
      parentSelector: isKeyValue ? this.generateSelector($, parent[0]) : null
    };
  }
  
  static generateSelector($, element) {
    const $el = $(element);
    
    const id = $el.attr('id');
    if (id) return `#${id}`;
    
    const classes = $el.attr('class');
    if (classes) {
      const classList = classes.split(/\s+/).filter(c => c);
      
      for (const cls of classList) {
        const selector = `.${cls}`;
        if ($(selector).length === 1) return selector;
      }
      
      if (classList.length > 0) {
        const combinedSelector = '.' + classList.join('.');
        if ($(combinedSelector).length <= 3) return combinedSelector;
      }
    }
    
    const tag = element.name;
    if (classes) {
      const firstClass = classes.split(/\s+/)[0];
      return `${tag}.${firstClass}`;
    }
    
    if ($(tag).length <= 3) return tag;
    
    return this.generatePath($, element);
  }
  
  static generatePath($, element) {
    const path = [];
    let current = element;
    
    while (current && current.name) {
      const $current = $(current);
      const tag = current.name;
      const id = $current.attr('id');
      const classes = $current.attr('class');
      
      if (id) {
        path.unshift(`${tag}#${id}`);
        break;
      } else if (classes) {
        const firstClass = classes.split(/\s+/)[0];
        path.unshift(`${tag}.${firstClass}`);
      } else {
        path.unshift(tag);
      }
      
      current = current.parent;
      if (path.length > 5) break;
    }
    
    return path.join(' > ');
  }
  
  static analyzeKeyValuePattern($, sampleSelectors) {
    console.log('\n🔍 АНАЛИЗ KEY-VALUE ПАТТЕРНОВ\n');
    
    const elements = sampleSelectors
      .filter(s => s.found && s.isKeyValue)
      .map(s => s.element);
    
    if (elements.length < 2) {
      console.log('   ⚠️  Недостаточно данных для анализа паттерна');
      return null;
    }
    
    const parents = elements.map(el => $(el).parent()[0]);
    const commonParent = this.findCommonParent($, parents);
    
    if (!commonParent) {
      console.log('   ⚠️  Не найден общий родитель');
      return null;
    }
    
    console.log(`   ✅ Общий родитель: ${this.generateSelector($, commonParent)}`);
    
    const $parent = $(commonParent);
    const children = $parent.children();
    
    const pattern = {
      containerSelector: this.generateSelector($, commonParent),
      itemSelector: null,
      keySelector: null,
      valueSelector: null
    };
    
    const firstChild = children.first()[0];
    if (firstChild) {
      pattern.itemSelector = firstChild.name;
      const itemClass = $(firstChild).attr('class');
      if (itemClass) {
        pattern.itemSelector += '.' + itemClass.split(/\s+/)[0];
      }
      
      console.log(`   Item selector: ${pattern.itemSelector}`);
      
      const $firstChild = $(firstChild);
      const spans = $firstChild.find('span');
      
      if (spans.length >= 2) {
        pattern.keySelector = 'span:first-child';
        pattern.valueSelector = 'span:last-child';
      } else if (spans.length === 1) {
        pattern.valueSelector = 'span';
      }
      
      console.log(`   Key selector: ${pattern.keySelector || 'text node'}`);
      console.log(`   Value selector: ${pattern.valueSelector}`);
    }
    
    return pattern;
  }
  
  static findCommonParent($, elements) {
    if (elements.length === 0) return null;
    if (elements.length === 1) return $(elements[0]).parent()[0];
    
    const firstParents = [];
    let current = $(elements[0]).parent()[0];
    while (current) {
      firstParents.push(current);
      current = $(current).parent()[0];
    }
    
    for (const parent of firstParents) {
      const isCommon = elements.every(el => 
        $(el).parents().toArray().includes(parent)
      );
      
      if (isCommon) return parent;
    }
    
    return null;
  }
  
  static generateReport(results, html) {
    const $ = cheerio.load(html);
    
    console.log('\n\n📊 ФИНАЛЬНЫЙ ОТЧЕТ\n');
    console.log('='.repeat(80));
    
    console.log('\n1️⃣  НАЙДЕННЫЕ СЕЛЕКТОРЫ:\n');
    
    const found = Object.entries(results).filter(([_, v]) => v.found);
    const notFound = Object.entries(results).filter(([_, v]) => !v.found);
    
    for (const [field, data] of found) {
      console.log(`✅ ${field}`);
      console.log(`   Селектор: ${data.selector}`);
      console.log('');
    }
    
    if (notFound.length > 0) {
      console.log('\n❌ НЕ НАЙДЕНО:\n');
      for (const [field, _] of notFound) {
        console.log(`   - ${field}`);
      }
    }
    
    console.log('\n2️⃣  KEY-VALUE ПАТТЕРН:\n');
    const kvPattern = this.analyzeKeyValuePattern($, found.map(([_, v]) => v));
    
    if (kvPattern) {
      console.log('   Найден паттерн для attributes:');
      console.log(`   Container: ${kvPattern.containerSelector}`);
      console.log(`   Item: ${kvPattern.itemSelector}`);
      console.log(`   Key: ${kvPattern.keySelector || 'text node'}`);
      console.log(`   Value: ${kvPattern.valueSelector}`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    return {
      selectors: results,
      pattern: kvPattern
    };
  }
}

module.exports = SelectorFinder;
