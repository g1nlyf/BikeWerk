import { FinalJson, FetchResult } from '../types';
import { loadBrands } from '../config';

const BRANDS = new Set(loadBrands().map(b => b.toLowerCase()));

export interface ScoreResult {
    finalScore: number;
    breakdown: Record<string, number>;
    shouldKeep: boolean;
    shouldPublish: boolean;
}

export const scoreListing = (data: Partial<FinalJson>, fetchResult?: FetchResult): ScoreResult => {
    if (!data) {
        console.warn('⚠️ scoreListing received undefined data');
        return {
            finalScore: 0,
            breakdown: { error: -1 },
            shouldKeep: false,
            shouldPublish: false
        };
    }

    let score = 0;
    const breakdown: Record<string, number> = {};

    // 1. Brand Score (+0.3)
    if (data.brand && BRANDS.has(data.brand.toLowerCase())) {
        score += 0.3;
        breakdown['brand_whitelist'] = 0.3;
    }

    // 2. Images Score (+0.2 if >= 3)
    // Note: We might need to get image count from fetchResult or data
    const imageCount = data.images?.length || 0;
    if (imageCount >= 3) {
        score += 0.2;
        breakdown['images_count'] = 0.2;
    } else if (imageCount > 0) {
        score += 0.1;
        breakdown['images_exist'] = 0.1;
    }

    // 3. Description Length (+0.1 if detailed)
    if (data.description && data.description.length > 100) {
        score += 0.1;
        breakdown['desc_length'] = 0.1;
    }

    // 4. Price Reality Check
    if (data.price) {
        if (data.price > 200 && data.price < 8000) {
            score += 0.1;
            breakdown['price_sanity'] = 0.1;
        } else {
            score -= 0.2; // Penalty for suspicious pricing
            breakdown['price_penalty'] = -0.2;
        }
    }

    // 5. Seller Type (Private vs Commercial - usually neutral, but maybe prefer private?)
    // Leaving neutral for now.

    // Normalize score 0..1
    score = Math.max(0, Math.min(1, score));

    // LOWER THRESHOLDS for testing
    const KEEP_THRESHOLD = 0.4; // Was 0.65
    const PUBLISH_THRESHOLD = 0.6; // Was 0.85

    return {
        finalScore: score,
        breakdown,
        shouldKeep: score >= KEEP_THRESHOLD,
        shouldPublish: score >= PUBLISH_THRESHOLD
    };
};
