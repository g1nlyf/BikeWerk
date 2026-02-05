/**
 * Category Constants
 * 
 * Единый источник правды для категорий и дисциплин.
 * Используется Hunter'ом, UnifiedNormalizer'ом и API.
 * 
 * ВАЖНО: Значения ДОЛЖНЫ соответствовать тому, что хранится в БД!
 * DB uses: category = 'mtb', discipline = 'enduro'/'trail_riding'/'cross_country'
 */

// Категории (основные типы велосипедов) - lowercase для БД
const CATEGORIES = {
    MTB: 'mtb',
    ROAD: 'road',
    GRAVEL: 'gravel',
    EMTB: 'emtb',
    KIDS: 'kids'
};

// Дисциплины - значения ДОЛЖНЫ соответствовать БД
const DISCIPLINES = {
    // MTB - DB values
    DH: 'downhill',           // В БД нет DH пока, будет downhill
    ENDURO: 'enduro',         // Есть в БД
    TRAIL: 'trail_riding',    // Есть в БД как trail_riding
    XC: 'cross_country',      // Есть в БД как cross_country

    // Road
    AERO: 'aero',
    CLIMBING: 'climbing',
    ENDURANCE: 'endurance',

    // Gravel
    RACE: 'race',
    ALL_ROAD: 'all_road'
};

// Маппинг из unified-brands-catalog.json в нормализованные значения БД
const CATEGORY_MAPPING = {
    // Из конфига -> В БД (lowercase)
    'MTB': 'mtb',
    'Road': 'road',
    'Gravel': 'gravel',
    'eMTB': 'emtb',
    'Kids': 'kids'
};

// Маппинг discipline из конфига в значения БД
const DISCIPLINE_MAPPING = {
    // Config value -> DB value
    'DH': 'downhill',
    'Enduro': 'enduro',
    'Trail': 'trail_riding',
    'XC': 'cross_country',
    'Aero': 'aero',
    'Climbing': 'climbing',
    'Endurance': 'endurance',
    'Race': 'race',
    'All-road': 'all_road',
    null: null
};

/**
 * Нормализует категорию в lowercase (для БД)
 */
function normalizeCategory(category) {
    if (!category) return null;
    const normalized = CATEGORY_MAPPING[category];
    if (normalized) return normalized;
    return category.toLowerCase();
}

/**
 * Нормализует дисциплину в значение БД
 */
function normalizeDiscipline(discipline) {
    if (discipline === null || discipline === undefined) return null;
    const normalized = DISCIPLINE_MAPPING[discipline];
    if (normalized !== undefined) return normalized;
    // Fallback: lowercase with underscores
    return discipline.toLowerCase().replace(/[- ]/g, '_');
}

/**
 * Конвертирует конфиг категории в БД-формат
 */
function configToDb(categoryConfig) {
    return {
        category: normalizeCategory(categoryConfig.category),
        discipline: normalizeDiscipline(categoryConfig.discipline)
    };
}

module.exports = {
    CATEGORIES,
    DISCIPLINES,
    CATEGORY_MAPPING,
    DISCIPLINE_MAPPING,
    normalizeCategory,
    normalizeDiscipline,
    configToDb
};
