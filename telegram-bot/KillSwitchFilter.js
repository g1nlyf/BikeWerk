
class KillSwitchFilter {
    constructor() {
        this.reasons = {
            PRICE_TOO_LOW: 'Price < 50€ (Trash/Parts)',
            SEARCH_REQUEST: 'User is searching (Suche)',
            NO_IMAGES: 'No images detected',
            DESCRIPTION_TOO_SHORT: 'Description < 50 chars',
            SCAM_SUSPICION: 'New Account + Super Low Price',
            KEYWORD_BLOCK: 'Blocked Keyword detected'
        };
    }

    /**
     * Evaluates a listing candidate
     * @param {Object} candidate - { title, price, description, images, sellerMemberSince, link }
     * @returns {Object} { shouldKill: boolean, reason: string|null }
     */
    evaluate(candidate) {
        // 1. Keyword Check (Title)
        const lowerTitle = (candidate.title || '').toLowerCase();
        if (lowerTitle.includes('suche') || lowerTitle.includes('kaufe')) {
            return { shouldKill: true, reason: this.reasons.SEARCH_REQUEST };
        }
        const text = `${candidate.title || ''} ${candidate.description || ''}`.toLowerCase();
        const blocked = [
            'motorrad',
            'moped',
            'mofa',
            'roller',
            'scooter',
            'motorroller',
            'motorbike',
            'quad',
            'atv',
            'pitbike',
            'pit bike',
            'crossbike',
            'cross bike',
            'dirtbike',
            'dirt bike',
            'trial',
            'supermoto',
            'enduro bike'
        ];
        for (const word of blocked) {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(text)) {
                return { shouldKill: true, reason: this.reasons.KEYWORD_BLOCK };
            }
        }

        // 2. Price Safety
        // Skip if price is missing (0) or extremely low (< 50€)
        // Exception: Maybe frames? But for now, safe guard.
        if (candidate.price > 0 && candidate.price < 50) {
            return { shouldKill: true, reason: this.reasons.PRICE_TOO_LOW };
        }

        // 3. Image Count
        // If images array exists and is empty
        if (candidate.images && candidate.images.length === 0) {
            return { shouldKill: true, reason: this.reasons.NO_IMAGES };
        }

        // 4. Description Length
        const desc = candidate.description || '';
        if (desc.length < 50) {
            return { shouldKill: true, reason: this.reasons.DESCRIPTION_TOO_SHORT };
        }

        // 5. Scam Heuristics
        // If account is "Heute" (Today) or very new, AND price is suspicious
        // Note: memberSince format varies ("10.11.2011" or "Heute")
        // We need robust parsing in Parser, but here we check raw string if needed.
        // For now, simple check.
        if (candidate.sellerMemberSince && candidate.sellerMemberSince.toLowerCase().includes('heute')) {
            // New account. Check price.
            // If it's a "S-Works" for 500€, kill it.
            // Simple heuristic: High end keyword + Low Price
            if (this.isHighEnd(candidate.title) && candidate.price < 1000) {
                 return { shouldKill: true, reason: this.reasons.SCAM_SUSPICION };
            }
        }

        return { shouldKill: false, reason: null };
    }

    isHighEnd(title) {
        const t = title.toLowerCase();
        return t.includes('s-works') || t.includes('dogma') || t.includes('cervelo') || t.includes('pinarello');
    }
}

module.exports = KillSwitchFilter;
