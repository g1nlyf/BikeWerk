class ArbiterService {
    constructor() {
        this.thresholds = {
            yearDiff: 1, // Allow 1 year difference (e.g. model year vs production year)
            numericMismatch: 0.2 // 20% difference allowed
        };
    }

    /**
     * Validates data integrity between Parser (Regex/DOM) and AI (Gemini)
     * @param {Object} parserData - Data extracted by KleinanzeigenParser
     * @param {Object} geminiData - Data extracted by GeminiProcessor
     * @returns {Object} { needsReview: boolean, reasons: string[] }
     */
    validate(parserData, geminiData) {
        const reasons = [];
        let needsReview = false;

        // 1. Year Check
        if (parserData.year && geminiData.year) {
            const diff = Math.abs(parserData.year - geminiData.year);
            if (diff > this.thresholds.yearDiff) {
                needsReview = true;
                reasons.push(`YEAR_CONFLICT: Parser=${parserData.year} vs AI=${geminiData.year}`);
            }
        }

        // 2. Material Check (Strict Text Match)
        if (parserData.frame_material && geminiData.material) {
            const pMat = this.normalizeMaterial(parserData.frame_material);
            const aMat = this.normalizeMaterial(geminiData.material);
            if (pMat && aMat && pMat !== aMat) {
                needsReview = true;
                reasons.push(`MATERIAL_CONFLICT: Parser=${pMat} vs AI=${aMat}`);
            }
        }

        // 3. Frame Size Check
        // Complex because sizes can be "L" vs "56cm". 
        // We only compare if both are simple letters or both are numbers
        // NOTE: Size conflicts are logged but don't block - AI is usually more reliable
        if (parserData.frameSize && geminiData.frameSize) {
            if (!this.areSizesCompatible(parserData.frameSize, geminiData.frameSize)) {
                // Log warning but don't block - AI often extracts size from description more accurately
                console.log(`[ARBITER] ⚠️ SIZE_WARNING: Parser=${parserData.frameSize} vs AI=${geminiData.frameSize} (AI trusted)`);
                // Don't set needsReview for size - trust AI
            }
        }

        // 4. Price Check (Safety Net)
        if (parserData.price && geminiData.price) {
            const pPrice = Number(parserData.price);
            const aPrice = Number(geminiData.price);
            if (pPrice > 0 && aPrice > 0) {
                const diff = Math.abs(pPrice - aPrice) / ((pPrice + aPrice) / 2);
                if (diff > 0.2) { // > 20% diff
                    needsReview = true;
                    reasons.push(`PRICE_CONFLICT: Parser=${pPrice} vs AI=${aPrice}`);
                }
            }
        }

        // --- MERGE LOGIC (FIX #3) ---
        // Critical fields check
        const criticalFields = ['brand', 'model', 'price'];
        const mergedData = { ...parserData, ...geminiData }; // AI overwrites Parser

        for (const field of criticalFields) {
            if (!mergedData[field]) {
                console.log(`[ARBITER] ❌ CRITICAL: Missing ${field}`);
                console.log(`  Parser: ${parserData[field]}`);
                console.log(`  AI: ${geminiData[field]}`);
                
                return {
                    needsReview: true,
                    reasons: [`missing_${field}`],
                    approved: false,
                    data: null
                };
            }
        }

        // Log conflicts for debugging/audit
        if (reasons.length > 0) {
            console.log(`[ARBITER] ⚠️ Conflicts detected: ${reasons.join(', ')}`);
        }

        // Check for high-severity conflicts
        // Material conflict and critical missing fields are considered high severity
        const highSeverity = reasons.filter(r => 
            r.includes('MATERIAL_CONFLICT') || 
            r.includes('PRICE_CONFLICT')  // Price conflicts are serious
        );
        
        if (highSeverity.length > 0) {
            console.log('[ARBITER] ❌ High-severity conflicts detected. Manual review required.');
            return {
                needsReview: true,
                reasons,
                approved: false,
                data: mergedData // Return data but marked as not approved
            };
        }

        // Low severity conflicts (year diff) - allow but flag
        if (needsReview) {
            console.log('[ARBITER] ⚠️ Low-severity conflicts detected. Proceeding with AI data.');
        }

        console.log('[ARBITER] ✅ Data merge complete. Approved.');
        return {
            needsReview: false,  // Allow processing if only low-severity issues
            reasons,
            approved: true,
            data: mergedData
        };
    }

    normalizeMaterial(mat) {
        if (!mat) return null;
        const m = mat.toLowerCase();
        if (m.includes('carbon') || m.includes('cf') || m.includes('kohlefaser')) return 'carbon';
        if (m.includes('alu') || m.includes('alloy')) return 'aluminum';
        if (m.includes('steel') || m.includes('stahl') || m.includes('crmo')) return 'steel';
        if (m.includes('titan')) return 'titanium';
        return 'other';
    }

    areSizesCompatible(s1, s2) {
        const str1 = String(s1).toUpperCase().trim();
        const str2 = String(s2).toUpperCase().trim();
        
        if (str1 === str2) return true;
        
        // Check letters
        const letters = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
        if (letters.includes(str1) && letters.includes(str2)) {
            return str1 === str2; // Strict for letters
        }

        // Check numbers (cm)
        const n1 = parseFloat(str1.replace(/[^0-9.]/g, ''));
        const n2 = parseFloat(str2.replace(/[^0-9.]/g, ''));
        
        if (!isNaN(n1) && !isNaN(n2)) {
            // Allow 2cm difference
            return Math.abs(n1 - n2) <= 2;
        }

        // If mixed (L vs 56), we can't easily validate without a lookup table.
        // Assume compatible to avoid false positives unless we are sure.
        return true; 
    }
}

module.exports = ArbiterService;
