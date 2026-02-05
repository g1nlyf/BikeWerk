const { URL } = require('url');
const WebSearch = require('./web-search');
const GeminiProcessor = require('./gemini-processor');
const gp = new GeminiProcessor(process.env.GEMINI_API_KEY || '', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');

const USED_MARKETPLACES = [
  'kleinanzeigen.de', 'ebay-kleinanzeigen.de', 'avito.ru', 'youla.ru', 'facebook.com',
  'willhaben.at', 'leboncoin.fr', 'subito.it', 'olx.pl', 'olx.ua', 'olx.ro', 'marktplaats.nl',
  'gumtree.com', 'gumtree.co.uk'
];

const RETAIL_STORES = [
  'canyon.com', 'trekbikes.com', 'specialized.com', 'cube.eu', 'orbea.com', 'giant-bicycles.com',
  'bike-discount.de', 'bike24.com', 'rosebikes.de', 'decathlon', 'chainreactioncycles.com', 'wiggle.com'
];

const DISCIPLINE_KEYWORDS = [
  { key: 'Downhill', aliases: ['downhill', 'dh', 'park', 'gravity', '200mm', '190mm'] },
  { key: 'Enduro', aliases: ['enduro', 'super enduro', '170mm', '160mm'] },
  { key: 'Trail', aliases: ['trail', 'all mountain', '140mm', '130mm'] },
  { key: 'Cross-Country', aliases: ['xc', 'xco', 'cross country', 'hardtail race'] },
  { key: 'Gravel', aliases: ['gravel', 'all-road', 'allroad'] },
  { key: 'Cyclocross', aliases: ['cyclocross', 'cx'] },
  { key: 'Road Racing', aliases: ['road', 'race', 'aero', 'climbing', 'endurance road'] },
  { key: 'Time Trial', aliases: ['tt', 'time trial', 'triathlon'] },
  { key: 'Urban/Street', aliases: ['city', 'urban', 'commuter'] },
  { key: 'Touring', aliases: ['touring', 'bikepacking'] },
  { key: 'E-MTB', aliases: ['emtb', 'e-mtb'] },
  { key: 'Kids', aliases: ['kids', 'kinder', 'youth'] }
];

function extractDomain(originalUrl) {
  try {
    const u = new URL(originalUrl);
    return u.host.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function classifyPlatform(domain) {
  if (!domain) return 'unknown';
  if (USED_MARKETPLACES.some(d => domain.endsWith(d))) return 'used_marketplace';
  if (RETAIL_STORES.some(d => domain.includes(d))) return 'retail_store';
  return 'unknown';
}

function pickDisciplineFromText(text) {
  const lower = (text || '').toLowerCase();
  for (const d of DISCIPLINE_KEYWORDS) {
    if (d.aliases.some(a => lower.includes(a))) {
      return d.key;
    }
  }
  return null;
}

async function detectDisciplineBySearch(brand, model) {
  const query = [brand || '', model || '', 'bike'].filter(Boolean).join(' ');
  try {
    const results = await WebSearch.search(query, 6);
    let votes = {};
    for (const r of results) {
      const text = `${r.title} ${r.snippet} ${r.url}`;
      const d = pickDisciplineFromText(text);
      if (d) votes[d] = (votes[d] || 0) + 1;
    }
    const entries = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return { discipline: null, confidence: 0 };
    const [top, count] = entries[0];
    const confidence = Math.min(1, count / results.length);
    const subCategory = top;
    return { discipline: top, subCategory, confidence };
  } catch (e) {
    return { discipline: null, confidence: 0 };
  }
}

function refineCategory(baseCategory, discipline) {
  const d = String(discipline || '').toLowerCase();
  if (!d) return baseCategory || 'Городской';
  if (d.includes('gravel')) return 'Гравийный';
  if (d.includes('cyclocross') || d.includes('cx')) return 'Шоссейный';
  if (d.includes('road')) return 'Шоссейный';
  if (d.includes('mtb') || d.includes('e-mtb') || d.includes('emtb')) {
    if (d.includes('downhill') || d.includes('dh')) return 'Горный';
    if (d.includes('enduro')) return 'Горный';
    if (d.includes('trail')) return 'Горный';
    if (d.includes('cross-country') || d.includes('xc')) return 'Горный';
  }
  if (d.includes('urban') || d.includes('city') || d.includes('commuter') || d.includes('touring') || d.includes('trekking')) return baseCategory || 'Городской';
  return baseCategory || 'Городской';
}

async function verifyAndEnhanceBikeData(bike) {
  const domain = extractDomain(bike.originalUrl || bike.url || '');
  const platformType = classifyPlatform(domain);
  const isNew = platformType === 'retail_store' ? true : platformType === 'used_marketplace' ? false : false;
  const guessedCondition = isNew ? 'new' : 'used';

  const textBlob = [bike.title, bike.description].filter(Boolean).join(' ');
  let localDisc = pickDisciplineFromText(textBlob);
  let searchDisc = { discipline: null, subCategory: null, confidence: 0 };
  if (!localDisc) {
    searchDisc = await detectDisciplineBySearch(bike.brand, bike.model);
    localDisc = searchDisc.discipline;
  }
  let gDisc = null;
  let gIsBike = null;
  let gConf = 0;
  if (gp.apiKey && !localDisc) {
    try {
      const prompt = [
        'Определи тип и дисциплину для объявления о велосипеде по заголовку и описанию.',
        'Верни валидный JSON без пояснений с полями:',
        'type, discipline, label, isBike, confidence',
        'Правила:',
        '— type: одно из MTB, ROAD, GRAVEL, eMTB, BMX, CITY, KIDS, HYBRID, FOLDING, PARTS.',
        '— discipline: одно из Enduro, Downhill, Trail, Cross-Country, Gravel, Road, Cyclocross, Urban, Touring, BMX, Kids, eMTB, Parts.',
        '— Особое правило: для eMTB дисциплина всегда "eMTB" (без подтипов).',
        '— label: комбинированная метка вида "MTB Enduro", "MTB DH", "ROAD Gravel", "eMTB" (без суффиксов), "PARTS Frame".',
        '— isBike: true если продается целый велосипед; false если рама/запчасти.',
        '— confidence: число 0..1.',
        `Заголовок: ${bike.title || ''}`,
        `Описание: ${bike.description || ''}`
      ].join('\n');
      const resp = await gp.callGeminiAPI(prompt);
      let parsed = {};
      try {
        parsed = JSON.parse(resp.replace(/```json\s*/gi, '').replace(/```/g, '').trim());
      } catch (_) {}
      if (parsed && typeof parsed === 'object') {
        gDisc = parsed.label || null;
        gIsBike = typeof parsed.isBike === 'boolean' ? parsed.isBike : null;
        gConf = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
      }
    } catch (_) {}
  }

  const gIsParts = typeof gDisc === 'string' && /parts/i.test(gDisc);
  const finalDisc = gIsParts ? (localDisc || bike.discipline || gDisc || null) : (gDisc || localDisc || bike.discipline || null);
  const finalCategory = refineCategory(bike.category, finalDisc);
  const confidence = Math.max(searchDisc.confidence, localDisc ? 0.6 : 0, gConf || 0);
  const needsReview = platformType === 'unknown' || confidence < 0.4;

  return {
    ...bike,
    isNew,
    condition: guessedCondition,
    category: finalCategory,
    discipline: finalDisc,
    subCategory: searchDisc.subCategory || null,
    classificationConfidence: confidence,
    isBike: gIsParts ? true : (typeof gIsBike === 'boolean' ? gIsBike : bike.isBike === true ? true : false),
    needsReview,
    sourceDomain: domain,
    sourcePlatformType: platformType
  };
}

module.exports = {
  verifyAndEnhanceBikeData
};