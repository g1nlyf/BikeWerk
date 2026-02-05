const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('ts-node').register({
  project: path.resolve(__dirname, './tsconfig.json'),
  transpileOnly: true
});
const { smartFilter } = require('./autocat-klein/dist/autocat-klein/src/lib/smartFilter');
const KleinanzeigenParser = require('./kleinanzeigen-parser');
const GeminiProcessor = require('./gemini-processor');
const ImageHandler = require('./image-handler');
const BikesDatabase = require('./bikes-database-node');
const PostProcessor = require('./post-processor');
const { checkKleinanzeigenStatus } = require('./status-checker');
const ValuationService = require('../backend/src/services/ValuationService');

// --- RATE LIMITER QUEUE ---
const msgQueue = [];
let isQueueRunning = false;

async function enqueueMessage(bot, chatId, text, opts) {
  return new Promise((resolve, reject) => {
    msgQueue.push({ bot, chatId, text, opts, resolve, reject });
    processMsgQueue();
  });
}

async function processMsgQueue() {
  if (isQueueRunning) return;
  isQueueRunning = true;
  while (msgQueue.length > 0) {
    const item = msgQueue[0]; // Peek
    try {
      await item.bot.sendMessage(item.chatId, item.text, item.opts);
      item.resolve();
      msgQueue.shift(); // Remove only after success
      // Force 1.5s delay between messages to be safe
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      if (e.response && e.response.statusCode === 429) {
         const wait = (e.response.parameters && e.response.parameters.retry_after) || 10;
         console.log(`⚠️ Telegram Rate Limit. Waiting ${wait}s...`);
         await new Promise(r => setTimeout(r, (wait * 1000) + 1000));
         // Loop will retry the same item
      } else {
         console.error('❌ Msg failed:', e.message);
         item.reject(e);
         msgQueue.shift(); // Drop failed message
         await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  isQueueRunning = false;
}
// --------------------------

const parser = new KleinanzeigenParser();
const imageHandler = new ImageHandler();
const bikesDB = new BikesDatabase();
// const { geminiClient } = require('./autocat-klein/dist/autocat-klein/src/lib/geminiClient.js');
const geminiKey = process.env.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS || '').split(/[,;|\s]+/).filter(Boolean)[0] || '';
const gp = new GeminiProcessor(geminiKey, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-pro-preview:generateContent');
// gp.setMultiKeyClient(geminiClient);
const { analyzeWithLLM } = require('./llm-analyzer.ts');

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    timeout: 20000
  });
  return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
}

function parseSearchItems(html) {
  const $ = cheerio.load(html);
  const items = [];
  $('article.aditem').each((_, el) => {
    const $el = $(el);
    const linkEl = $el.find('a.ellipsis');
    const link = linkEl.attr('href');
    const title = linkEl.text().trim();
    const price = $el.find('.aditem-main--middle--price-shipping--price').text().trim();
    let oldPrice = '';
    const priceContainer = $el.find('.aditem-main--middle');
    const strike = priceContainer.find('s, del, .struck-price, .old-price, .uvp-price, [style*="line-through"], .boxedarticle--price--strike-through').first();
    if (strike && strike.length) {
      oldPrice = strike.text().trim();
    }
    const location = $el.find('.aditem-main--top--left').text().trim();
    if (link && title) {
      const fullUrl = link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`;
      items.push({ title, price, oldPrice, link: fullUrl, location, date: '', snippet: '' });
    }
  });
  return items;
}

function briefItemsSummary(items) {
  const take = items.slice(0, 5);
  return take.map(i => `• ${i.title} | ${i.price} | ${i.location}`).join('\n');
}

async function safeSend(bot, chatId, text, parseMode) {
  try {
    const max = 3500;
    if (text.length <= max) {
      const opts = parseMode ? { parse_mode: parseMode } : {};
      return await enqueueMessage(bot, chatId, text, opts);
    }
    const parts = Math.ceil(text.length / max);
    for (let i = 0; i < parts; i++) {
      const chunk = text.slice(i * max, (i + 1) * max);
      const opts = parseMode ? { parse_mode: parseMode } : {};
      await enqueueMessage(bot, chatId, chunk, opts);
    }
  } catch (e) {
    const safeText = text.slice(0, 3000);
    await enqueueMessage(bot, chatId, safeText, {}); // Fallback without parse_mode
  }
}

async function sendJson(bot, chatId, title, obj) {
  const json = JSON.stringify(obj, null, 2);
  const header = `${title}\n`;
  const blockStart = '```json\n';
  const blockEnd = '\n```';
  const max = 3000; // keep margin for markdown wrappers
  if (json.length + header.length + blockStart.length + blockEnd.length <= 3800) {
    return await safeSend(bot, chatId, `${header}${blockStart}${json}${blockEnd}`, 'Markdown');
  }
  const parts = Math.ceil(json.length / max);
  for (let i = 0; i < parts; i++) {
    const chunk = json.slice(i * max, (i + 1) * max);
    await safeSend(bot, chatId, `${title} (часть ${i + 1}/${parts})\n${blockStart}${chunk}${blockEnd}`, 'Markdown');
  }
}

async function processSingleListing(bot, chatId, url) {
  console.log(`[STAGE 1] -> [SOURCING] -> Processing URL: ${url}`);
  await safeSend(bot, chatId, `🚀 START PROCESSING ${url}`);
  
  const startTime = Date.now();
  const html = await fetchHtml(url);
  const fetchTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const sizeKB = (html.length / 1024).toFixed(2);
  
  await safeSend(bot, chatId, `⬇️ HTML FETCHED (${fetchTime}s, ${sizeKB}KB)`);
  
  const raw = parser.extractBikeData(html, url);
  console.log(`[STAGE 1] -> [RAW PARSING] -> Extracted: Title="${raw.title}", Price=${raw.price}, Location="${raw.location}"`);
  
  const rawForLog = { ...raw };
  if (rawForLog && rawForLog.rawHtmlContent) delete rawForLog.rawHtmlContent;
  // await sendJson(bot, chatId, '📊 Данные сайта:', rawForLog);

  const llmResult = await analyzeWithLLM(html, url);
  await safeSend(bot, chatId, `🤖 LLM ANALYSIS COMPLETED`);
  
  let processed = llmResult && llmResult.stage1 && llmResult.stage1.data ? llmResult.stage1.data : {};
  console.log(`[STAGE 3] -> [LLM INTELLIGENCE] -> Category: ${processed.category} (Normalized), Specs Extracted: ${!!processed.year}`);
  // await sendJson(bot, chatId, '🤖 Результат HTML‑Gemini:', processed);

  let unifiedPre = await gp.finalizeUnifiedData(raw, processed);
  const hasEssential = !!(unifiedPre && unifiedPre.brand && unifiedPre.model && typeof unifiedPre.price === 'number' && unifiedPre.price > 0);
  const needFallback = !hasEssential;
  let vis = null;
  let slices = [];
  if (needFallback) {
    await safeSend(bot, chatId, '🔄 Fallback: capturing screenshots...');
    vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000 });
    slices = Array.isArray(vis.slices) ? vis.slices : [];
    if (!slices || slices.length < 2) {
      vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, 'screenshots'), postLoadDelayMs: 2000, slowMo: 50 });
      slices = Array.isArray(vis.slices) ? vis.slices : [];
    }
    if (slices.length === 0 && vis && vis.telegramPhotoPath) {
      slices = [vis.telegramPhotoPath];
    }
    await safeSend(bot, chatId, `📸 Screenshots captured: ${slices.length}`);
    if (slices.length >= 2) {
      const processedFallback = await gp.processBikeDataFromTwoShots(slices[0], slices[1], { originalUrl: url });
      processed = { ...processedFallback, processedMode: 'multimodal' };
    } else if (slices.length >= 1) {
      const processedFallback = await gp.processBikeDataFromImages(slices, { originalUrl: url });
      processed = { ...processedFallback, processedMode: 'multimodal' };
    }
    // await sendJson(bot, chatId, '🤖 Результат Gemini по скриншотам:', processed);
  }

  let unified = await gp.finalizeUnifiedData(raw, processed);
  if (typeof unified.price === 'string') {
    const s = String(unified.price).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(/,/g, '.');
    const n = Math.round(parseFloat(s || '0'));
    unified.price = Number.isFinite(n) ? n : 0;
  } else if (typeof unified.price === 'number') {
    unified.price = Math.round(unified.price);
  }
  if (!unified.originalPrice && raw && raw.originalPrice) {
    unified.originalPrice = raw.originalPrice;
  }
  unified = await PostProcessor.verifyAndEnhanceBikeData(unified);
  const fallbackTitle = String((raw && raw.title) || '').trim();
  const titleParts = fallbackTitle ? fallbackTitle.split(/\s+/) : [];
  let safeBrand = unified.brand || titleParts[0];
  let safeModel = unified.model || (titleParts.length > 1 ? titleParts.slice(1).join(' ') : '');
  if (!safeBrand) safeBrand = 'Unknown';
  if (!safeModel) safeModel = 'Unknown';
  const safeName = (unified.name || `${safeBrand} ${safeModel}`).trim();
  // await sendJson(bot, chatId, '🧠 Единый результат:', unified);

  const dbData = {
    name: safeName,
    category: unified.category || 'Городской',
    brand: safeBrand,
    model: safeModel,
    frameSize: unified.frameSize,
    price: unified.price,
    originalPrice: unified.originalPrice || unified.oldPrice || (raw && raw.originalPrice),
    images: [],
    isNew: unified.isNew === true,
    description: unified.description,
    features: raw.sellerBadges || unified.sellerBadges || [],
    deliveryOption: unified.deliveryOption,
    source: 'telegram-test-autocat',
    originalUrl: url,
    condition: unified.condition || (unified.isNew ? 'new' : 'used'),
    year: unified.year,
    wheelDiameter: unified.wheelDiameter,
    location: unified.location,
    isNegotiable: unified.isNegotiable,
    discipline: unified.discipline,
    initial_quality_class: unified.initial_quality_class || null,
    sellerName: raw.sellerName || unified.sellerName,
    sellerBadges: raw.sellerBadges || unified.sellerBadges,
    sellerType: raw.sellerType || unified.sellerType,
    sellerMemberSince: raw.sellerMemberSince || unified.sellerMemberSince,
    sourceAdId: unified.sourceAdId || null,
    isBike: unified.isBike === true
  };
  // await sendJson(bot, chatId, '💾 Финальный JSON для БД:', dbData);

  const saved = await bikesDB.addBike(dbData);
  console.log(`[STAGE 5] -> [PERSISTENCE] -> Bike Saved to DB with ID: ${saved.id}. Table 'bikes' updated.`);
  
  // Verify FMV calculation for this new bike (Audit Step)
  try {
      const fmvData = await ValuationService.calculateFMV({
          brand: saved.brand,
          model: saved.model,
          year: saved.year
      });
      console.log(`[STAGE 2/4 CHECK] -> [FMV CALCULATION] -> Calculated FMV for ${saved.brand} ${saved.model}: ${fmvData.fmv}€ (Confidence: ${fmvData.confidence}, Samples: ${fmvData.sampleSize})`);
      
      const discount = fmvData.fmv ? Math.round((1 - saved.price / fmvData.fmv) * 100) : 0;
      console.log(`[STAGE 4 PREVIEW] -> [DEAL LOGIC] -> Discount: ${discount}%. Is Hot (>15%)? ${discount > 15}. Is Super (>30%)? ${discount > 30}.`);
  } catch (e) {
      console.error(`[AUDIT ERROR] -> Failed to calculate FMV: ${e.message}`);
  }

  await safeSend(bot, chatId, `💾 SAVED TO DB: ID ${saved.id} (${saved.brand} ${saved.model})`);

  let localImagePaths = [];
  let imagesToDownload = (raw.images && raw.images.length > 0) ? raw.images : (unified.images && unified.images.length > 0 ? unified.images : []);
  imagesToDownload = Array.isArray(imagesToDownload) ? imagesToDownload.filter(u => /img\.kleinanzeigen\.de\/api\/v1\/prod-ads\/images\//.test(String(u))) : [];
  if (imagesToDownload.length > 0) {
    try {
      localImagePaths = await imageHandler.downloadAndProcessImages(imagesToDownload, saved.id);
      if (localImagePaths && localImagePaths.length > 0) {
        await bikesDB.addBikeImages(saved.id, localImagePaths);
        await bikesDB.updateBike(saved.id, { main_image: localImagePaths[0] });
        await safeSend(bot, chatId, `🖼️ IMAGES SAVED: ${localImagePaths.length}`);
      }
    } catch (e) {
      await safeSend(bot, chatId, `❌ Ошибка сохранения изображений: ${e.message}`);
    }
  } else {
    await safeSend(bot, chatId, '⚠️ NO IMAGES FOUND');
  }

  return { savedBike: saved, dbData, unified, processed, raw };
}

function normalizeCategory(s) {
  const v = String(s || '').toLowerCase();
  if (['mtb','горный','enduro','dh','trail','xc'].includes(v)) return 'mtb';
  if (['road','шоссе','rennrad'].includes(v)) return 'road';
  if (['gravel','гревел'].includes(v)) return 'gravel';
  if (['emtb','e-mtb','emtb','ebike','e-bike','электро'].includes(v)) return 'emtb';
  if (['kids','kid','детский','детские','детск','children'].includes(v)) return 'kids';
  return null;
}

const POPULAR_MODELS = {
  mtb: [
    'Specialized Stumpjumper', 'Specialized Enduro', 'Specialized Epic', 'Specialized Demo', 'Specialized Status',
    'Trek Fuel EX', 'Trek Slash', 'Trek Top Fuel', 'Trek Session', 'Trek Roscoe',
    'Canyon Spectral', 'Canyon Strive', 'Canyon Torque', 'Canyon Neuron', 'Canyon Sender', 'Canyon Lux',
    'Santa Cruz Nomad', 'Santa Cruz Megatower', 'Santa Cruz Hightower', 'Santa Cruz 5010', 'Santa Cruz V10', 'Santa Cruz Blur', 'Santa Cruz Tallboy', 'Santa Cruz Bronson',
    'YT Capra', 'YT Jeffsy', 'YT Tues', 'YT Izzo',
    'Propain Tyee', 'Propain Spindrift', 'Propain Hugene', 'Propain Rage',
    'Commencal Meta', 'Commencal Clash', 'Commencal Supreme',
    'Orbea Rallon', 'Orbea Occam', 'Orbea Oiz',
    'Scott Genius', 'Scott Spark', 'Scott Ransom', 'Scott Gambler',
    'Cube Stereo', 'Cube Two15', 'Cube AMS',
    'Giant Reign', 'Giant Trance', 'Giant Anthem', 'Giant Glory',
    'Pivot Firebird', 'Pivot Switchblade', 'Pivot Mach',
    'Yeti SB160', 'Yeti SB140', 'Yeti SB120', 'Yeti SB150',
    'Rocky Mountain Altitude', 'Rocky Mountain Instinct', 'Rocky Mountain Element', 'Rocky Mountain Slayer',
    'Norco Sight', 'Norco Range', 'Norco Optic',
    'Radon Swoop', 'Radon Slide', 'Radon Jealous',
    'Focus Jam', 'Focus Sam', 'Focus Thron',
    'Mondraker Foxy', 'Mondraker Superfoxy', 'Mondraker Summum',
    'Nukeproof Mega', 'Nukeproof Giga', 'Nukeproof Reactor',
    'Raaw Madonna', 'Raaw Jibb',
    'Transition Sentinel', 'Transition Patrol', 'Transition Spire'
  ],
  road: [
    'Specialized Tarmac', 'Specialized Roubaix', 'Specialized Aethos', 'Specialized Allez',
    'Trek Madone', 'Trek Domane', 'Trek Emonda',
    'Canyon Aeroad', 'Canyon Ultimate', 'Canyon Endurace',
    'Giant Propel', 'Giant TCR', 'Giant Defy',
    'Cannondale SystemSix', 'Cannondale SuperSix', 'Cannondale Synapse', 'Cannondale CAAD',
    'Scott Foil', 'Scott Addict',
    'BMC Teammachine', 'BMC Roadmachine', 'BMC Timemachine Road',
    'Cervelo S5', 'Cervelo R5', 'Cervelo Caledonia', 'Cervelo Soloist',
    'Pinarello Dogma', 'Pinarello Prince', 'Pinarello Gan',
    'Colnago V4Rs', 'Colnago C68', 'Colnago V3Rs',
    'Bianchi Oltre', 'Bianchi Specialissima', 'Bianchi Infinito', 'Bianchi Aria',
    'Cube Litening', 'Cube Agree', 'Cube Attain',
    'Rose X-Lite', 'Rose Reveal',
    'Orbea Orca', 'Orbea Orca Aero',
    'Merida Scultura', 'Merida Reacto',
    'Ridley Noah', 'Ridley Helium', 'Ridley Fenix',
    'Wilier Filante', 'Wilier 0 SLR', 'Wilier Cento',
    'Focus Izalco',
    'Argon 18 Gallium', 'Argon 18 Nitrogen',
    'Factor Ostro', 'Factor O2'
  ],
  gravel: [
    'Canyon Grizl', 'Canyon Grail',
    'Specialized Diverge', 'Specialized Crux',
    'Trek Checkpoint',
    'Cannondale Topstone',
    'Giant Revolt',
    'Scott Addict Gravel',
    'Rose Backroad',
    'Cube Nuroad',
    'Orbea Terra',
    'Cervelo Aspero',
    'BMC URS',
    '3T Exploro',
    'Santa Cruz Stigmata',
    'Ridley Kanzo',
    'Focus Atlas',
    'Rondo Ruut',
    'Open UP', 'Open UPPER', 'Open WI.DE',
    'Merida Silex',
    'Bianchi Impulso', 'Bianchi Arcadex',
    'Factor LS',
    'Wilier Rave', 'Wilier Jena'
  ],
  emtb: [
    'Specialized Turbo Levo', 'Specialized Kenevo',
    'Canyon Spectral:ON', 'Canyon Torque:ON', 'Canyon Strive:ON', 'Canyon Neuron:ON',
    'Trek Rail', 'Trek Fuel EXe',
    'Orbea Rise', 'Orbea Wild',
    'Santa Cruz Heckler', 'Santa Cruz Bullit',
    'Cube Stereo Hybrid',
    'Haibike AllMtn', 'Haibike Nduro',
    'Scott Lumen', 'Scott Patron', 'Scott Strike',
    'Giant Trance X E+', 'Giant Reign E+',
    'Merida eOne-Sixty', 'Merida eOne-Forty',
    'Focus JAM²', 'Focus SAM²',
    'Rotwild R.X750', 'Rotwild R.E750',
    'YT Decoy',
    'Commencal Meta Power',
    'Propain Ekano',
    'Radon Render',
    'Mondraker Crafty', 'Mondraker Level',
    'Rocky Mountain Altitude Powerplay',
    'Pivot Shuttle',
    'Norco Sight VLT', 'Norco Range VLT'
  ],
  kids: [
    'Specialized Riprock 20', 'Specialized Riprock 24',
    'Specialized Hotrock 20', 'Specialized Jett 24',
    'Early Rider Belter 20', 'Early Rider Belter 24',
    'Early Rider Hellion 20', 'Early Rider Hellion 24'
  ]
};

function buildTemplates(categoryKey) {
  let list = [];
  
  if (categoryKey && POPULAR_MODELS[categoryKey]) {
    list = POPULAR_MODELS[categoryKey];
  } else if (!categoryKey) {
    // If no category specified, use all
    list = [
      ...POPULAR_MODELS.mtb,
      ...POPULAR_MODELS.road,
      ...POPULAR_MODELS.gravel,
      ...POPULAR_MODELS.emtb
    ];
  } else {
    // Fallback for unknown category
    list = POPULAR_MODELS.mtb; 
  }

  return list.map(q => {
    const slug = String(q).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { name: q, urlPattern: `https://www.kleinanzeigen.de/s-fahrraeder/${slug}/k0c217`, type: 'dynamic' };
  });
}

function parsePriceEUR(s) {
  const t = String(s || '').replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(/,(?=\d{2}\b)/g, '.');
  const m = t.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

async function processCategoryQuota(bot, chatId, category, quota, opts) {
  if (quota <= 0) return;

  let templates = [];
  if (opts.customQuery) {
    // Override templates with custom query
    templates = [{
        name: `Custom Search: ${opts.customQuery}`,
        urlPattern: `https://www.kleinanzeigen.de/s-fahrraeder/${opts.customQuery.replace(/\s+/g, '-').toLowerCase()}/k0c210+fahrraeder.seite:{page}`
    }];
  } else {
    templates = buildTemplates(category);
  }

  if (!templates.length) {
    await safeSend(bot, chatId, `⚠️ Нет шаблонов для категории ${category}`);
    return;
  }

  let saved = 0;
  const shuffledTemplates = shuffle(templates);
  let idx = 0;
  let failures = 0;

  await safeSend(bot, chatId, `📂 Категория: ${category.toUpperCase()} (Цель: ${quota})`);

  while (saved < quota) {
    if (idx >= shuffledTemplates.length) idx = 0;
    const t = shuffledTemplates[idx++];
    
    // Random page 1-3 to get variety
    const maxPages = 3;
    const pageNum = Math.floor(Math.random() * maxPages) + 1;
    const url = t.urlPattern.replace('{page}', String(pageNum));
    
    // await safeSend(bot, chatId, `🔎 Поиск: ${t.name} (стр. ${pageNum})`);
    
    try {
      const html = await fetchHtml(url);
      let items = shuffle(parseSearchItems(html));

      // Silent Collector: Save all items to market_history (Test 2 Fix)
      await bikesDB.logMarketHistory(items);
      console.log(`[STAGE 2] -> [SILENT COLLECTOR] -> Saved ${items.length} raw items to market_history. Immediate availability for FMV: YES.`);
      
      if (opts.minPrice && opts.maxPrice) {
        const minP = Number(opts.minPrice);
        const maxP = Number(opts.maxPrice);
        items = items.filter(it => {
          const p = parsePriceEUR(it.price);
          return p >= minP && p <= maxP;
        });
      }

      // Filter logic
      const { selectedUrls } = await smartFilter.selectTopCandidates(items);
      
      // Take up to 2 candidates per search to ensure variety (don't take all 3 from same page if possible, or do?)
      // User wants "top 3 and with them work".
      const candidates = shuffle(selectedUrls).slice(0, 3);
      
      if (candidates.length === 0) {
        failures++;
        if (failures > 5) {
             console.log(`⚠️ Мало результатов для ${category}, пропускаем шаблон.`);
             // await safeSend(bot, chatId, `⚠️ Мало результатов для ${category}, пропускаем шаблон.`);
             failures = 0;
        }
        continue; 
      }

      for (const u of candidates) {
        if (saved >= quota) break;
        
        const exists = await bikesDB.getBikeByOriginalUrl(u);
        if (exists) {
          continue;
        }
        
        try {
            await processSingleListing(bot, chatId, u);
            saved++;
            await new Promise(r => setTimeout(r, 2000)); // 2s delay to be safe
        } catch (e) {
            console.error(e);
            // await safeSend(bot, chatId, `❌ Ошибка: ${e.message}`);
            await new Promise(r => setTimeout(r, 2000)); // Wait on error too
        }
      }
    } catch (e) {
      console.error(`Error fetching ${url}:`, e);
      await new Promise(r => setTimeout(r, 5000)); // Backoff
    }
  }
  await safeSend(bot, chatId, `✅ Категория ${category.toUpperCase()} выполнена (${saved}/${quota})`);
}

async function runAutonomous(bot, chatId, count, opts = {}) {
  // If category is explicitly set by user, run only that
  if (opts.category) {
      await safeSend(bot, chatId, `🚀 Старт авто-каталога (Категория: ${opts.category}, Цель: ${count})`);
      await processCategoryQuota(bot, chatId, opts.category, count, opts);
      await safeSend(bot, chatId, `🎉 Готово.`);
      return;
  }

  // Distribution Logic
  const mtbCount = Math.round(count * 0.60);
  const emtbCount = Math.round(count * 0.20);
  let roadGravelCount = count - mtbCount - emtbCount;
  
  // Split road/gravel roughly equally
  const roadCount = Math.ceil(roadGravelCount / 2);
  const gravelCount = Math.floor(roadGravelCount / 2);

  await safeSend(bot, chatId, `🚀 Старт авто-каталога (Всего: ${count})\n📊 План: MTB: ${mtbCount}, eMTB: ${emtbCount}, Road: ${roadCount}, Gravel: ${gravelCount}`);

  await processCategoryQuota(bot, chatId, 'mtb', mtbCount, opts);
  await processCategoryQuota(bot, chatId, 'emtb', emtbCount, opts);
  await processCategoryQuota(bot, chatId, 'road', roadCount, opts);
  await processCategoryQuota(bot, chatId, 'gravel', gravelCount, opts);

  await safeSend(bot, chatId, `🎉 Авто-каталог завершен! Добавлено ~${count} велосипедов.`);
}

async function runTestAutocat(bot, chatId, input) {
  if (!input) {
    await safeSend(bot, chatId, 'Использование: /test_autocat <кол-во> [категория] [мин-макс] | либо URL');
    return;
  }
  if (/^https?:\/\//i.test(String(input))) {
    const url = String(input);
    const html = await fetchHtml(url);
    const items = shuffle(parseSearchItems(html));
    await safeSend(bot, chatId, `1. Парсим каталог. Успешно — найдено ${items.length}.\n${briefItemsSummary(items)}`);
    const { selectedUrls, reasons } = await smartFilter.selectTopCandidates(items);
    const diversified = shuffle(selectedUrls).slice(0, 3);
    await safeSend(bot, chatId, `2. Анализируем байки. Успешно.\nПричина: ${reasons.llm_selection || 'fallback'}\n3. Выбраны: ${diversified.length}.`);
    for (const u of diversified) {
      const exists = await bikesDB.getBikeByOriginalUrl(u);
      if (exists) {
        await safeSend(bot, chatId, `⏭️ Пропуск: уже в БД (ID ${exists.id}) — ${u}`);
        continue;
      }
      await processSingleListing(bot, chatId, u);
      await new Promise(r => setTimeout(r, 1500));
    }
    await safeSend(bot, chatId, '🏁 Тест завершен.');
    return;
  }
  const parts = String(input).split(/\s+/).filter(Boolean);
  let n = 3;
  let category = null;
  let minPrice = null;
  let maxPrice = null;
  let customQueryParts = [];

  for (const p of parts) {
    if (/^\d+$/.test(p)) { n = Math.max(1, parseInt(p, 10)); continue; }
    if (/^\d+\s*-\s*\d+$/.test(p)) { const [a,b] = p.split('-'); minPrice = parseInt(a,10); maxPrice = parseInt(b,10); continue; }
    const cat = normalizeCategory(p);
    if (cat) {
      if (!category) { category = cat; continue; }
      if (category === cat && p !== category) { customQueryParts.push(p); }
      continue;
    }
    customQueryParts.push(p);
  }

  const customQuery = customQueryParts.length > 0 ? customQueryParts.join(' ') : null;
  if (customQuery && !category) category = 'mtb'; // Default to mtb if only query provided

  await runAutonomous(bot, chatId, n, { category, minPrice, maxPrice, customQuery });
}

module.exports = { runTestAutocat };
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
