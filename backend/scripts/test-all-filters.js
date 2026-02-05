/**
 * Comprehensive test script for all catalog filters
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('\n🧪 COMPREHENSIVE CATALOG FILTER TEST\n');
console.log('='.repeat(60));

// Category aliases (same as server.js)
const CATEGORY_ALIASES = {
    'Горный': 'mtb', 'Mountain': 'mtb', 
    'Шоссейный': 'road', 'Road': 'road',
    'Гравийный': 'gravel', 'Gravel': 'gravel',
    'Электро': 'emtb', 'eMTB': 'emtb', 'ebike': 'emtb',
    'Детский': 'kids', 'Kids': 'kids'
};

function normalizeCategory(cat) {
    if (!cat) return null;
    return CATEGORY_ALIASES[cat] || cat.toLowerCase();
}

// Helper to build query
function buildQuery(filters = {}) {
    let where = ['is_active = TRUE'];
    let params = [];
    
    if (filters.category) {
        const normalized = normalizeCategory(filters.category);
        where.push('category = ?');
        params.push(normalized);
    }
    
    if (filters.sub_category) {
        const subs = Array.isArray(filters.sub_category) ? filters.sub_category : [filters.sub_category];
        const ph = subs.map(() => '?').join(', ');
        where.push(`(sub_category IN (${ph}) OR discipline IN (${ph}))`);
        params.push(...subs, ...subs);
    }
    
    if (filters.brand) {
        where.push('brand = ?');
        params.push(filters.brand);
    }
    
    if (filters.status === 'new') {
        where.push('is_new = 1');
    } else if (filters.status === 'used') {
        where.push('is_new = 0');
    }
    
    if (filters.minPrice) {
        where.push('price >= ?');
        params.push(parseFloat(filters.minPrice));
    }
    
    if (filters.maxPrice) {
        where.push('price <= ?');
        params.push(parseFloat(filters.maxPrice));
    }
    
    if (filters.size) {
        const sizes = Array.isArray(filters.size) ? filters.size : [filters.size];
        const ph = sizes.map(() => 'UPPER(TRIM(size)) = ?').join(' OR ');
        where.push(`(${ph})`);
        params.push(...sizes.map(s => s.toUpperCase().trim()));
    }
    
    if (filters.search) {
        where.push('(name LIKE ? OR brand LIKE ? OR model LIKE ?)');
        const term = `%${filters.search}%`;
        params.push(term, term, term);
    }
    
    if (filters.hot) {
        where.push('is_hot_offer = 1');
    }
    
    return { where: where.join(' AND '), params };
}

function testFilter(name, filters, expectedMin = 0) {
    const { where, params } = buildQuery(filters);
    const sql = `SELECT COUNT(*) as cnt FROM bikes WHERE ${where}`;
    const result = db.prepare(sql).get(...params);
    const count = result.cnt;
    const passed = count >= expectedMin;
    console.log(`${passed ? '✅' : '❌'} ${name}: ${count} bikes`);
    if (!passed) {
        console.log(`   Expected at least ${expectedMin}, got ${count}`);
        console.log(`   SQL: ${sql}`);
        console.log(`   Params: ${JSON.stringify(params)}`);
    }
    return passed;
}

let passed = 0;
let total = 0;

// 1. Category Tests
console.log('\n📁 CATEGORY FILTERS\n');
total++; if (testFilter('MTB category', { category: 'mtb' }, 50)) passed++;
total++; if (testFilter('Road category', { category: 'road' }, 2)) passed++;
total++; if (testFilter('Gravel category', { category: 'gravel' }, 1)) passed++;
total++; if (testFilter('eMTB category', { category: 'emtb' }, 1)) passed++;

// 2. Sub-category Tests (MTB)
console.log('\n🏔️ MTB SUB-CATEGORY FILTERS\n');
total++; if (testFilter('MTB Enduro', { category: 'mtb', sub_category: 'enduro' }, 5)) passed++;
total++; if (testFilter('MTB Trail', { category: 'mtb', sub_category: 'trail' }, 20)) passed++;
total++; if (testFilter('MTB DH', { category: 'mtb', sub_category: 'dh' }, 2)) passed++;
total++; if (testFilter('MTB XC', { category: 'mtb', sub_category: 'xc' }, 0)) passed++;
total++; if (testFilter('MTB Trail OR Enduro', { category: 'mtb', sub_category: ['trail', 'enduro'] }, 30)) passed++;

// 3. Sub-category Tests (Road)
console.log('\n🚴 ROAD SUB-CATEGORY FILTERS\n');
total++; if (testFilter('Road Race', { category: 'road', sub_category: 'race' }, 1)) passed++;
total++; if (testFilter('Road Aero', { category: 'road', sub_category: 'aero' }, 0)) passed++;
total++; if (testFilter('Road Endurance', { category: 'road', sub_category: 'endurance' }, 0)) passed++;

// 4. Sub-category Tests (Gravel)
console.log('\n🛤️ GRAVEL SUB-CATEGORY FILTERS\n');
total++; if (testFilter('Gravel Adventure', { category: 'gravel', sub_category: 'adventure' }, 1)) passed++;
total++; if (testFilter('Gravel Race', { category: 'gravel', sub_category: 'race' }, 0)) passed++;

// 5. Price Range Tests
console.log('\n💰 PRICE RANGE FILTERS\n');
total++; if (testFilter('Price < 1000€', { maxPrice: 1000 }, 1)) passed++;
total++; if (testFilter('Price 1000-3000€', { minPrice: 1000, maxPrice: 3000 }, 1)) passed++;
total++; if (testFilter('Price > 5000€', { minPrice: 5000 }, 1)) passed++;

// 6. Size Tests
console.log('\n📏 SIZE FILTERS\n');
total++; if (testFilter('Size M', { size: 'M' }, 20)) passed++;
total++; if (testFilter('Size L', { size: 'L' }, 15)) passed++;
total++; if (testFilter('Size S', { size: 'S' }, 5)) passed++;
total++; if (testFilter('Size XL', { size: 'XL' }, 3)) passed++;
total++; if (testFilter('Size M or L', { size: ['M', 'L'] }, 40)) passed++;

// 7. Condition Tests
console.log('\n🔧 CONDITION FILTERS\n');
total++; if (testFilter('New bikes', { status: 'new' }, 0)) passed++;
total++; if (testFilter('Used bikes', { status: 'used' }, 50)) passed++;

// 8. Search Tests
console.log('\n🔍 SEARCH FILTERS\n');
total++; if (testFilter('Search "Canyon"', { search: 'Canyon' }, 5)) passed++;
total++; if (testFilter('Search "Specialized"', { search: 'Specialized' }, 3)) passed++;
total++; if (testFilter('Search "Trek"', { search: 'Trek' }, 1)) passed++;

// 9. Combined Filters
console.log('\n🔀 COMBINED FILTERS\n');
total++; if (testFilter('MTB + Size M', { category: 'mtb', size: 'M' }, 20)) passed++;
total++; if (testFilter('MTB Enduro + Size L', { category: 'mtb', sub_category: 'enduro', size: 'L' }, 1)) passed++;
total++; if (testFilter('MTB Trail + Price < 3000€', { category: 'mtb', sub_category: 'trail', maxPrice: 3000 }, 5)) passed++;

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 SUMMARY: ${passed}/${total} tests passed`);
if (passed === total) {
    console.log('✅ ALL FILTERS WORKING CORRECTLY!\n');
} else {
    console.log(`⚠️ ${total - passed} tests failed\n`);
}

// Distribution Report
console.log('='.repeat(60));
console.log('\n📈 DATA DISTRIBUTION REPORT\n');

console.log('Categories:');
db.prepare(`SELECT category, COUNT(*) as cnt FROM bikes WHERE is_active = TRUE GROUP BY category ORDER BY cnt DESC`).all()
  .forEach(r => console.log(`  ${r.category}: ${r.cnt}`));

console.log('\nSub-categories:');
db.prepare(`SELECT sub_category, COUNT(*) as cnt FROM bikes WHERE is_active = TRUE AND sub_category IS NOT NULL GROUP BY sub_category ORDER BY cnt DESC`).all()
  .forEach(r => console.log(`  ${r.sub_category}: ${r.cnt}`));

console.log('\nSizes:');
db.prepare(`SELECT size, COUNT(*) as cnt FROM bikes WHERE is_active = TRUE AND size IS NOT NULL GROUP BY size ORDER BY cnt DESC`).all()
  .forEach(r => console.log(`  ${r.size}: ${r.cnt}`));

console.log('\nBrands (top 10):');
db.prepare(`SELECT brand, COUNT(*) as cnt FROM bikes WHERE is_active = TRUE AND brand IS NOT NULL GROUP BY brand ORDER BY cnt DESC LIMIT 10`).all()
  .forEach(r => console.log(`  ${r.brand}: ${r.cnt}`));

db.close();
console.log('\n');
