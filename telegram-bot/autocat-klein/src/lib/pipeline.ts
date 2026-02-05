import { fetcher } from './fetcher';
import { minifyHtml, cleanHtml } from './htmlUtils';
import { fastParseHtml } from './fastParser';
import { llmService } from './llm';
import { scoreListing } from './scoring';
import { storage } from './storage';
import { playwrightService } from '../workers/playwrightWorker';
import { FinalJson } from '../types';
const GeminiProcessor = require('../../../gemini-processor');
const { checkKleinanzeigenStatus } = require('../../../status-checker');

export interface ProcessResult {
    success: boolean;
    status: string;
    score: number;
    data?: FinalJson;
    breakdown?: any;
}

export class Pipeline {
    
    async processListing(url: string): Promise<ProcessResult> {
        console.log(`байк - ссылка ${url}`);

        try {
            // A) Fetch
            const fetchResult = await fetcher.fetchPage(url);
            const minifiedHtml = await minifyHtml(cleanHtml(fetchResult.html));
            
            // B) Fast Parse
            const candidates = fastParseHtml(minifiedHtml);
            console.log('HTML парсинг успешно');

            let processedMode: "html-only" | "multимодал" = "html-only";

            // D) Screenshot Parsing with 3 parallel browsers and 3 processors
            const keysRaw = String(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '');
            const keysList = keysRaw.split(',').map(s => s.trim()).filter(Boolean);
            const keys3 = keysList.length >= 3 ? keysList.slice(0, 3) : (keysList.length > 0 ? [keysList[0], keysList[0], keysList[0]] : ['', '', '']);

            const visTasks = [
                checkKleinanzeigenStatus(url, { headless: true }),
                checkKleinanzeigenStatus(url, { headless: true }),
                checkKleinanzeigenStatus(url, { headless: true })
            ];
            const visResults = await Promise.allSettled(visTasks);

            const slicesPerRun: string[][] = visResults.map((r: any) => {
                if (r.status === 'fulfilled' && r.value && Array.isArray(r.value.slices)) {
                    return r.value.slices;
                }
                return [];
            });

            const baseSlices = slicesPerRun.find(a => a.length > 0) || [];
            const processors = keys3.map(k => new GeminiProcessor(k, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'));

            const context = {
                originalUrl: url,
                title: candidates.title || null,
                description: candidates.descriptionCandidate || null
            } as any;

            const imagePromises = processors.map((gp: any, i: number) => {
                const imgs = (slicesPerRun[i] && slicesPerRun[i].length > 0) ? slicesPerRun[i] : baseSlices;
                if (imgs.length >= 2) {
                    return gp.processBikeDataFromTwoShots(imgs[0], imgs[1], context);
                }
                return gp.processBikeDataFromImages(imgs, context);
            });
            const imageResults = await Promise.allSettled(imagePromises);
            const parsedImageData = imageResults
                .filter(r => r.status === 'fulfilled')
                .map((r: any) => r.value);

            console.log('Скриншот-парсинг успешно');

            const pickBest = (arr: any[], field: string) => {
                for (const x of arr) {
                    if (x && x[field]) return x[field];
                }
                return null;
            };
            const pickLongest = (arr: any[], field: string) => {
                let best = null;
                let len = 0;
                for (const x of arr) {
                    const v = x && x[field];
                    if (typeof v === 'string' && v.length > len) { best = v; len = v.length; }
                }
                return best;
            };

            const imageCombined: any = {
                brand: pickBest(parsedImageData, 'brand'),
                model: pickBest(parsedImageData, 'model'),
                price: pickBest(parsedImageData, 'price'),
                location: pickBest(parsedImageData, 'location'),
                frameSize: pickBest(parsedImageData, 'frameSize'),
                wheelDiameter: pickBest(parsedImageData, 'wheelDiameter'),
                year: pickBest(parsedImageData, 'year'),
                category: pickBest(parsedImageData, 'category'),
                discipline: pickBest(parsedImageData, 'discipline'),
                isNegotiable: pickBest(parsedImageData, 'isNegotiable'),
                deliveryOption: pickBest(parsedImageData, 'deliveryOption'),
                sellerName: pickBest(parsedImageData, 'sellerName'),
                sellerMemberSince: pickBest(parsedImageData, 'sellerMemberSince'),
                sellerBadges: pickBest(parsedImageData, 'sellerBadges'),
                sellerType: pickBest(parsedImageData, 'sellerType'),
                sourceAdId: pickBest(parsedImageData, 'sourceAdId'),
                isBike: pickBest(parsedImageData, 'isBike'),
                description: pickLongest(parsedImageData, 'description')
            };

            const gpForMerge = processors[0];
            const rawForMerge: any = {
                title: candidates.title || null,
                description: candidates.descriptionCandidate || null,
                brand: null,
                model: null,
                price: null,
                location: candidates.locationCandidate || null,
                frameSize: null,
                wheelDiameter: null,
                year: null,
                category: null,
                isNegotiable: null,
                deliveryOption: null,
                originalUrl: url
            };

            const merged = await gpForMerge.finalizeUnifiedData(rawForMerge, imageCombined);

            // Merge Data
            const finalJson: FinalJson = {
                ...(merged as any),
                originalUrl: url,
                sourceAdId: candidates.rawAdId || (merged as any).sourceAdId || null,
                processedByGemini: true,
                processingDate: new Date().toISOString(),
                processedMode: 'multimodal',
                isActive: true,
                images: candidates.imageCandidates // Use parsed images
            };

            // H) Save
            const scoreResult = scoreListing(finalJson, fetchResult);
            const status = scoreResult.shouldPublish ? 'published' : (scoreResult.shouldKeep ? 'draft' : 'rejected');
            
            if (status !== 'rejected') {
                await storage.saveListing(finalJson, scoreResult.finalScore, status as any);
                console.log('Финальный результат -');
                console.log(JSON.stringify(finalJson));
                console.log('Байк добавлен!');
            } else {
                console.log(`Rejected ${url}`);
            }

            return { 
                success: true, 
                status, 
                score: scoreResult.finalScore,
                data: finalJson,
                breakdown: scoreResult.breakdown
            };

        } catch (error: any) {
            console.error(`Error processing listing ${url}:`, error.message);
            return { success: false, status: 'error', score: 0 };
        }
    }
}

export const pipeline = new Pipeline();
