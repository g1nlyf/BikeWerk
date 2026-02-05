const UnifiedNormalizer = require('./UnifiedNormalizer');

class TechDecoder {
    constructor() {
        this.normalizer = UnifiedNormalizer;
        
        // Patterns for regex-based extraction
        this.patterns = {
            material: {
                carbon: [/\bcarbon\b/i, /\bkohle/i, /\bcf\b/i, /\bsl\b/i, /\bcompact\b/i],
                aluminum: [/\balu(minium|minum)?\b/i, /\balloy\b/i],
                steel: [/\bstahl\b/i, /\bsteel\b/i, /\bchromoly\b/i, /\bcrmo\b/i],
                titanium: [/\btitan(ium)?\b/i]
            },
            wheelSize: {
                '29': [/\b29["\s]?\b/i, /\b29er\b/i, /\btwentyniner\b/i],
                '27.5': [/\b27[.,]5["\s]?\b/i, /\b650b\b/i],
                '26': [/\b26["\s]?\b/i],
                '28': [/\b28["\s]?\b/i, /\b700c\b/i]
            },
            frameSize: {
                'XS': [/\bxs\b/i, /\bextra\s?small/i],
                'S': [/\bsize\s?s\b/i, /\bsm\b/i, /\b(?<!x)small\b/i, /\bs[1-4]\b/i],
                'M': [/\bsize\s?m\b/i, /\bmed(ium)?\b/i, /\bm[1-4]\b/i],
                'L': [/\bsize\s?l\b/i, /\blarge\b/i, /\bl[1-4]\b/i],
                'XL': [/\bxl\b/i, /\bextra\s?large/i]
            }
        };
    }

    /**
     * Normalize bike data using Unified Format (Gemini 2.5 Flash)
     * @param {Object} bike - Raw bike object
     * @returns {Object} Unified Bike JSON
     */
    async normalize(bike, source = null, options = {}) {
        const resolvedSource = source || bike.source || bike.source_platform || bike.platform || null;
        return this.normalizer.normalize(bike, resolvedSource, options);
    }

    calculateQualityScore(bike) {
        let score = 50; // Base
        
        // Handle both flattened and nested structures
        const brand = bike.brand || bike.basic_info?.brand;
        const model = bike.model || bike.basic_info?.model;
        const year = bike.year || bike.basic_info?.year;
        const images = bike.images || bike.media?.gallery || [];
        const description = bike.description || bike.basic_info?.description || bike.description_summary;
        const image = bike.image || bike.media?.main_image;

        // Only add bonus if we have specific data points
        if (brand && model && brand !== 'Unknown' && model !== 'Unknown') score += 5;
        if (year && year > new Date().getFullYear() - 5) score += 5;
        if (images && images.length > 2) score += 5;
        if (description && description.length > 200) score += 5;
        
        // Cap manual score at 80 to distinguish from AI-verified (which can go to 100)
        let finalScore = Math.min(80, score);

        // Penalties
        if (!image && (!images || images.length === 0)) finalScore -= 30;
        if (description && description.length < 20) finalScore -= 10;
        
        return Math.min(100, Math.max(0, finalScore));
    }

    validateBike(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        
        // Frameset Keywords
        const framesetKeywords = [
            'rahmen', 'frameset', 'frame', 'rahmenset'
        ];
        
        for (const kw of framesetKeywords) {
            // Check word boundaries for exact match, but 'rahmen' is common inside words like 'fahrradrahmen'
            // User specifically asked for: Rahmen, Frameset, Frame, Rahmenset
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            if (regex.test(text)) {
                 // But wait, "Carbon Rahmen" is fine in description of a full bike.
                 // Usually framesets have this in TITLE.
                 // Let's check TITLE only for strong signal.
                 if (new RegExp(`\\b${kw}\\b`, 'i').test(title.toLowerCase())) {
                     // Check if it says "Rahmenhöhe" (Frame size) which is OK
                     if (kw === 'rahmen' && (title.toLowerCase().includes('rahmenhöhe') || title.toLowerCase().includes('rahmengr'))) {
                         // Likely OK
                     } else {
                         return { isBike: false, reason: `Frameset detected: ${kw}`, isFrameset: true };
                     }
                 }
            }
        }

        const forbidden = [
            'mercedes', 'bmw', 'audi', 'volkswagen', 'vw', 'auto', 'kfz', 
            'wohnwagen', 'wohnmobil', 'motorrad', 'moped', 'mofa', 'roller', 'scooter', 'motorroller', 'motorbike', 'quad', 'atv', 'pitbike', 'crossbike', 'dirtbike', 'supermoto', 'trial',
            'suche', 'gesucht', 'kaufe', // Wanted ads
            'defekt', 'bastler', 'broken', // Damaged
            'hymer', 'fiat', 'ducato', 'camper', 'caravan', 'kastenwagen' // Campers
        ];

        for (const word of forbidden) {
            // Check word boundaries to avoid false positives (e.g. "automated" -> auto)
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(text)) {
                // Exception for "Mercedes" if it's "Mercedes Team" bike or similar? 
                // Rare. Safer to block for now as requested.
                return { isBike: false, reason: `Forbidden keyword: ${word}` };
            }
        }
        
        return { isBike: true };
    }

    decode(title, description = '') {
        const text = `${title} ${description || ''}`.toLowerCase();
        
        // 1. First Validate
        const validation = this.validateBike(title, description);
        if (!validation.isBike) {
            return {
                isBike: false,
                isFrameset: validation.isFrameset || false,
                reason: validation.reason,
                material: null,
                wheelSize: null,
                frameSize: null,
                year: null
            };
        }

        const result = {
            material: null,
            wheelSize: null,
            frameSize: null,
            isBike: true
        };

        // Material Detection
        for (const [mat, patterns] of Object.entries(this.patterns.material)) {
            if (patterns.some(p => p.test(text))) {
                // Heuristic: If carbon found, but also 'bottle cage' or similar, ignore?
                // For now, simple priority: Carbon > Alloy
                if (!result.material || mat === 'carbon') {
                     result.material = mat.charAt(0).toUpperCase() + mat.slice(1);
                }
            }
        }

        // Wheel Size
        for (const [size, patterns] of Object.entries(this.patterns.wheelSize)) {
            if (patterns.some(p => p.test(text))) {
                result.wheelSize = size + '"';
                break; // First match wins
            }
        }

        // Frame Size
        for (const [size, patterns] of Object.entries(this.patterns.frameSize)) {
            if (patterns.some(p => p.test(text))) {
                result.frameSize = size;
                break;
            }
        }

        // Year Extraction (Simple Regex for 2015-2025)
        const yearMatch = text.match(/\b(201[5-9]|202[0-5])\b/);
        if (yearMatch) {
            result.year = parseInt(yearMatch[1]);
        }

        return result;
    }

    /**
     * Normalize Brand Name (Fuzzy Match / Correction)
     */
    normalizeBrand(input) {
        if (!input) return 'Unknown';
        let brand = input.trim();
        
        // Common corrections
        const corrections = {
            'specialised': 'Specialized',
            'cannondal': 'Cannondale',
            'yt industries': 'YT',
            'yt-industries': 'YT',
            'santa-cruz': 'Santa Cruz',
            'santacruz': 'Santa Cruz'
        };

        const lower = brand.toLowerCase();
        for (const [bad, good] of Object.entries(corrections)) {
            if (lower === bad || lower.includes(bad)) return good;
        }

        // Capitalize first letter
        return brand.charAt(0).toUpperCase() + brand.slice(1);
    }

    /**
     * Normalize Model Name (Clean up)
     */
    normalizeModel(input) {
        if (!input) return 'Unknown';
        let model = input.trim();
        
        // Remove year if present at start/end
        model = model.replace(/\b(201[5-9]|202[0-5])\b/g, '').trim();
        
        // Remove brand name if present
        // (This requires passing brand, but for simple normalization we just clean noise)
        
        return model.charAt(0).toUpperCase() + model.slice(1);
    }

    /**
     * Extract Year from Text
     */
    extractYear(text) {
        if (!text) return null;
        const match = text.match(/\b(201[5-9]|202[0-5])\b/);
        return match ? parseInt(match[1]) : null;
    }
}

module.exports = new TechDecoder();
