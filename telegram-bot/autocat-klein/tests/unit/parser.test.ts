import { fastParseHtml } from '../../src/lib/fastParser';
import * as fs from 'fs';
import * as path from 'path';

describe('Fast Parser', () => {
    it('should extract candidates from HTML', () => {
        const html = fs.readFileSync(path.join(__dirname, '../fixtures/listing.html'), 'utf-8');
        const result = fastParseHtml(html);

        expect(result.title).toBe('Specialized Enduro 2022');
        expect(result.priceCandidate).toBe('2.500 €');
        expect(result.rawAdId).toBe('123456789');
        expect(result.imageCandidates).toContain('img1.jpg');
    });

    it('should handle empty HTML gracefully', () => {
        const result = fastParseHtml('<html></html>');
        expect(result.title).toBeNull();
    });
});
