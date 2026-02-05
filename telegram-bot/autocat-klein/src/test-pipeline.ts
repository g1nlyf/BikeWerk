import axios from 'axios';
import * as cheerio from 'cheerio';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeWithLLM } from '../../llm-analyzer';
import { smartFilter, SearchItem } from './lib/smartFilter';
import { loadSearchTemplates } from './config';

// Helper to parse CLI args
const args = process.argv.slice(2);
const input = args[0];

// Imports matching bot.js logic
const KleinanzeigenParser = require('../../kleinanzeigen-parser');
const ImageHandler = require('../../image-handler');
const BikesDatabase = require('../../bikes-database-node');
const GeminiProcessor = require('../../gemini-processor');
const { checkKleinanzeigenStatus } = require('../../status-checker');
const PostProcessor = require('../../post-processor');

// Initialize modules
const parser = new KleinanzeigenParser();
const imageHandler = new ImageHandler();
const bikesDB = new BikesDatabase();
const gp = new GeminiProcessor(process.env.GEMINI_API_KEY || '', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');

// --- Helper Functions from bot.js ---

function parseGenericHtml(url: string, html: string) {
    const pick = (r: RegExp) => {
        if (!html) return null;
        const m = html.match(r);
        return m ? String(m[1]).trim() : null;
    };
    const title = pick(/<title[^>]*>([^<]{1,200})<\/title>/i) || pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || null;
    const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || null;
    let priceStr = null;
    const pm = html ? html.match(/([\d\s.,]{2,})\s?(€|eur)/i) : null;
    if (pm) priceStr = pm[1];
    let priceNum = 0;
    if (priceStr) {
        const s = priceStr.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
        const n = Math.round(parseFloat(s || '0'));
        priceNum = Number.isFinite(n) ? n : 0;
    }
    const images: string[] = [];
    if (html) {
        const ogImgs = [...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)];
        for (const m of ogImgs) { if (m[1]) images.push(m[1]); }
        if (images.length === 0) {
            const twImgs = [...html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi)];
            for (const m of twImgs) { if (m[1]) images.push(m[1]); }
        }
    }
    return { title, description: desc, price: priceNum, images, originalUrl: url };
}

// --- Main Logic Replicated from /tester ---

async function processLikeTester(url: string) {
    console.log(`🚀 Executing optimized analysis for: ${url}`);
    const startTime = Date.now();

    try {
        // 1. Fetch HTML
        const htmlStart = Date.now();
        const html = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        }).then(r => r.data);
        const htmlTime = Date.now() - htmlStart;

        // Extract basic images from HTML (OG tags)
        const basicData = parseGenericHtml(url, html);
        
        // 2. Analyze with LLM (includes HTML optimization + Gemini Fast Pass)
        const analysisStart = Date.now();
        const analysisResult = await analyzeWithLLM(html, url);
        const analysisTime = Date.now() - analysisStart;

        // 2.1 Capture screenshots and run Gemini multimodal EXACTLY like /tester
        console.log('📸 Capturing page screenshots...');
        let vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, '../screenshots'), postLoadDelayMs: 2000 });
        let slices = Array.isArray(vis.slices) ? vis.slices : [];
        if (!slices || slices.length < 2) {
            vis = await checkKleinanzeigenStatus(url, { headless: false, screenshotsDir: path.resolve(__dirname, '../screenshots'), postLoadDelayMs: 2000, slowMo: 50 });
            slices = Array.isArray(vis.slices) ? vis.slices : [];
        }
        if (slices.length === 0 && vis.telegramPhotoPath) {
            slices = [vis.telegramPhotoPath];
        }
        console.log(`🖼️ Screenshots captured: ${slices.length}`);

        // 2.2 Process with Gemini using images
        let processedBikeData: any = {};
        const context = {
            originalUrl: url,
            title: basicData.title || null,
            description: basicData.description || null
        };
        if (slices.length >= 2) {
            processedBikeData = await gp.processBikeDataFromTwoShots(slices[0], slices[1], context);
        } else {
            processedBikeData = await gp.processBikeDataFromImages(slices, context);
        }
        console.log('🤖 Результат Gemini:');
        console.log(JSON.stringify(processedBikeData, null, 2));
        
        // 3. Robust Parser Execution (The "Grok" way)
        let parserData: any = {};
        try {
            console.log('🖼️ Extracting images via KleinanzeigenParser (Grok-style)...');
            parserData = await parser.parseKleinanzeigenLink(url);
            console.log(`📸 Parser found ${parserData.images ? parserData.images.length : 0} images`);
        } catch (pErr) {
            console.error('Parser failed:', pErr);
        }

        // 4. Unify data EXACTLY like /tester via finalizeUnifiedData
        let finalData = await gp.finalizeUnifiedData(parserData, processedBikeData);
        if (typeof finalData.price === 'string') {
            const s = String(finalData.price).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(/,/g, '.');
            const n = Math.round(parseFloat(s || '0'));
            finalData.price = Number.isFinite(n) ? n : 0;
        } else if (typeof finalData.price === 'number') {
            finalData.price = Math.round(finalData.price);
        }

        // 4.1 Verify and enhance classification
        finalData = await PostProcessor.verifyAndEnhanceBikeData(finalData);

        // 5. Save to Database
        console.log('💾 Saving to Database...');
        
        // Prioritize Parser data for Seller and Images (as per bot.js)
        const dbData = {
            category: finalData.category || 'Городской',
            brand: finalData.brand,
            model: finalData.model,
            frameSize: finalData.frameSize,
            price: finalData.price,
            originalPrice: finalData.originalPrice || finalData.oldPrice,
            images: [],
            isNew: finalData.isNew === true,
            description: finalData.description,
            features: parserData.sellerBadges || finalData.sellerBadges || [],
            deliveryOption: finalData.deliveryOption,
            source: 'telegram-tester',
            originalUrl: url,
            condition: finalData.condition || (finalData.isNew ? 'new' : 'used'),
            year: finalData.year,
            wheelDiameter: finalData.wheelDiameter,
            location: finalData.location,
            isNegotiable: finalData.isNegotiable,
            discipline: finalData.discipline,
            sellerName: parserData.sellerName || finalData.sellerName,
            sellerBadges: parserData.sellerBadges || finalData.sellerBadges,
            sellerType: parserData.sellerType || finalData.sellerType,
            sellerMemberSince: parserData.sellerMemberSince || finalData.sellerMemberSince,
            sourceAdId: finalData.sourceAdId || null,
            isBike: finalData.isBike === true
        };

        const savedBike = await bikesDB.addBike(dbData);
        console.log(`✅ Bike added with ID: ${savedBike.id}`);

        // 6. Download and Save Images
        console.log('🖼️ Processing and saving images locally...');
        let localImagePaths: string[] = [];
        
        try {
            // Use parser images first; fallback to unified/site images
            const imagesToDownload = (parserData.images && parserData.images.length > 0) ? parserData.images : (finalData.images && finalData.images.length > 0 ? finalData.images : (basicData.images || []));
            
            if (imagesToDownload.length === 0) {
                 console.log('⚠️ No images found from parser');
            } else {
                // Use the ImageHandler to download and save
                localImagePaths = await imageHandler.downloadAndProcessImages(imagesToDownload, savedBike.id);
                
                if (localImagePaths && localImagePaths.length > 0) {
                    await bikesDB.addBikeImages(savedBike.id, localImagePaths);
                    
                    await bikesDB.updateBike(savedBike.id, {
                        main_image: localImagePaths[0]
                    });
                    
                    savedBike.images = localImagePaths;
                    savedBike.main_image = localImagePaths[0];
                    
                    console.log(`✅ Saved ${localImagePaths.length} images locally.`);
                }
            }
        } catch (imgErr: any) {
            console.error('Image processing failed:', imgErr);
        }

        // Print Summary + Gemini JSON for visibility
        console.log("\n🤖 Результат Gemini:");
        console.log(JSON.stringify(processedBikeData, null, 2));

        console.log("\n=== ФИНАЛЬНЫЙ АНАЛИЗ ===");
        const name = `${savedBike.brand || 'Unknown'} ${savedBike.model || ''}`.trim();
        console.log(`🚴 ${name.length ? name : 'Unknown Model'}`);
        console.log(`💰 Цена: ${savedBike.price || 0} EUR`);
        console.log(`📍 Локация: ${savedBike.location || 'Не указано'}`);
        console.log(`🖼️ Изображений: ${savedBike.images ? savedBike.images.length : 0}`);
        console.log(`🤖 Обработано Gemini: ${processedBikeData.processedByGemini ? '✅' : '❌'}`);
        console.log(`🆔 ID в каталоге: ${savedBike.id}`);

        return { success: true, data: savedBike };

    } catch (error: any) {
        console.error("Tester error:", error);
        return { success: false, status: 'error', error: error.message };
    }
}

// --- Execution Flow ---

async function run() {
    // Initialize DB if needed (BikesDatabase constructor does init, but async init might be safer if method exists)
    // bikesDB.initializeDatabase() is called in constructor.
    
    if (!input) {
        console.error("Использование: npx ts-node src/test-pipeline.ts <ссылка|количество>");
        process.exit(1);
    }

    const targetCount = parseInt(input);
    if (!isNaN(targetCount) && !input.startsWith('http')) {
        await runAutonomousMode(targetCount);
    } else {
        await runSingleMode(input);
    }

    process.exit(0);
}

async function runAutonomousMode(targetCount: number) {
    console.log(`🚀 Запуск автономного режима. Цель: ${targetCount} велосипедов.`);
    
    const templates = loadSearchTemplates().templates;
    let savedCount = 0;
    const shuffled = templates.sort(() => 0.5 - Math.random());
    let templateIdx = 0;

    while (savedCount < targetCount) {
        if (templateIdx >= shuffled.length) templateIdx = 0;
        const template = shuffled[templateIdx++];
        const searchUrl = template.urlPattern.replace('{page}', '1');
        console.log(`\n📂 Сканирование шаблона: ${template.name} (${searchUrl})`);

        const candidates = await processSearchPage(searchUrl);
        
        for (const url of candidates) {
            if (savedCount >= targetCount) break;

            console.log(`   👉 Обработка кандидата: ${url}`);
            const result = await processLikeTester(url);
            
            if (result.success) {
                savedCount++;
            } else {
                console.log(`      ❌ Ошибка обработки`);
            }
            
            // Brief pause
            await new Promise(r => setTimeout(r, 2000)); 
        }
    }
    console.log(`\n🎉 Цель достигнута! Сохранено ${savedCount} велосипедов.`);
}

async function runSingleMode(url: string) {
    console.log(`🚀 Обработка одной ссылки: ${url}`);

    if (url.includes('/s-anzeige/')) {
        await processLikeTester(url);
    } else {
        console.log("📂 Обнаружена страница поиска. Поиск лучших кандидатов...");
        const candidates = await processSearchPage(url);
        console.log(`Найдено ${candidates.length} кандидатов. Обработка...`);
        
        for (const candUrl of candidates) {
             console.log(`\n👉 ${candUrl}`);
             await processLikeTester(candUrl);
             await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function processSearchPage(url: string): Promise<string[]> {
    try {
        // Use axios for search page too to be consistent
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 20000
        });
        const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
        console.log(`📄 Type of data: ${typeof response.data}`);
        console.log(`📄 Content-Type: ${response.headers['content-type']}`);
        
        if (response.headers['content-type']?.includes('application/json')) {
            console.log('⚠️ Received JSON response instead of HTML. Dumping first 500 chars:');
            console.log(html.substring(0, 500));
        }

        console.log(`📄 Search Page HTML Length: ${html.length}`);
        console.log(`📄 Title: ${html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]}`);
        
        const $ = cheerio.load(html);
        const items: SearchItem[] = [];

        const adItems = $('article.aditem');
        console.log(`🔍 Found ${adItems.length} articles with selector 'article.aditem'`);

        adItems.each((_, el) => {
            const $el = $(el);
            const linkEl = $el.find('a.ellipsis');
            const link = linkEl.attr('href');
            const title = linkEl.text().trim();
            const price = $el.find('.aditem-main--middle--price-shipping--price').text().trim();
            const location = $el.find('.aditem-main--top--left').text().trim();
            
            if (link && title) {
                const fullUrl = link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`;
                items.push({
                    title,
                    price,
                    link: fullUrl,
                    location,
                    date: '',
                    snippet: ''
                });
            }
        });

        if (items.length === 0) {
            console.warn("⚠️ No items found on search page.");
            return [];
        }

        const { selectedUrls } = await smartFilter.selectTopCandidates(items);
        return selectedUrls;

    } catch (e: any) {
        console.error(`Error processing search page: ${e.message}`);
        return [];
    }
}

run().catch(console.error);
