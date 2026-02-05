import { scoreListing } from '../../src/lib/scoring';
import { FinalJson } from '../../src/types';

describe('Scoring System', () => {
    it('should score highly for whitelisted brands and good price', () => {
        const listing: Partial<FinalJson> = {
            brand: 'Specialized',
            price: 2500,
            description: 'Long description '.repeat(10),
            images: ['img1', 'img2', 'img3']
        };

        const result = scoreListing(listing);
        expect(result.finalScore).toBeGreaterThan(0.5);
        expect(result.breakdown).toHaveProperty('brand_whitelist');
        expect(result.breakdown).toHaveProperty('images_count');
    });

    it('should penalize suspicious prices', () => {
        const listing: Partial<FinalJson> = {
            brand: 'Specialized',
            price: 50, // Too low
            description: 'Scam',
            images: []
        };

        const result = scoreListing(listing);
        expect(result.breakdown).toHaveProperty('price_penalty');
        expect(result.finalScore).toBeLessThan(0.5);
    });
});
