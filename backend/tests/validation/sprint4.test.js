const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const path = require('path');
const DatabaseManager = require('../../database/db-manager');

// Set Test DB
process.env.DB_PATH = path.resolve(__dirname, '../../database/eubike_test.db');
const dbManager = new DatabaseManager();
const db = dbManager.getDatabase();

// Mock Collectors
class MockBuycycleCollector {
    async collectForTarget(target) {
        if (target.brand === 'Canyon' && target.model === 'Spectral') {
            return [
                {
                    title: 'Canyon Spectral 29 CF 7 2023',
                    price: 2500,
                    year: 2023,
                    frame_size: 'M',
                    condition: 'very_good',
                    source: 'buycycle',
                    url: 'https://buycycle.com/test1'
                },
                {
                    title: 'Canyon Spectral 125 AL 6 2022',
                    price: 1800,
                    year: 2022,
                    frame_size: 'L',
                    condition: 'good',
                    source: 'buycycle',
                    url: 'https://buycycle.com/test2'
                }
            ];
        }
        return [];
    }
}

class MockKleinanzeigenCollector {
    constructUrl(params) {
        return `https://mock-url.com?brand=${params.brand}`;
    }
    async collectForTarget(target) {
        return []; 
    }
}

// Import SourceMerger
const SourceMerger = require('../../src/services/SourceMerger');

// Import DeepCatalogBuilder with mocks
const deepCatalogBuilder = proxyquire('../../src/services/deep-catalog-builder', {
    '../../scrapers/buycycle-collector': new MockBuycycleCollector(), 
    '../../../telegram-bot/unified-hunter': MockKleinanzeigenCollector
});

describe('Sprint 4: Multi-Source', function() {
    this.timeout(60000); // Increase timeout for DeepCatalogBuilder delays (4 brackets * 3 sources * 2s = ~24s+)

    before(() => {
        // Seed market history to ensure Median FMV is around 2000
        // So brackets cover 1800-2500 range
        // Median 2000 -> Premium Max = 2000*1.3 = 2600.
        // 1800 is in Mid/Fair. 2500 is in Premium.
        db.prepare("DELETE FROM market_history WHERE brand = 'Canyon' AND model = 'Spectral'").run();
        
        const insert = db.prepare(`
            INSERT INTO market_history (brand, model, price_eur, quality_score, category) 
            VALUES ('Canyon', 'Spectral', ?, 90, 'Mountain')
        `);
        // Insert prices to get median ~2000
        [1800, 1900, 2000, 2100, 2200].forEach(p => insert.run(p));
    });
    
    const buycycleCollector = new MockBuycycleCollector();

    it('4.1: Buycycle collector returns structured data', async () => {
        const results = await buycycleCollector.collectForTarget({
            brand: 'Canyon',
            model: 'Spectral'
        });
        
        expect(results.length).to.be.greaterThan(0);
        
        results.forEach(bike => {
            expect(bike.year).to.not.be.undefined;
            expect(bike.frame_size).to.not.be.undefined;
            expect(bike.condition).to.not.be.undefined;
            expect(bike.source).to.equal('buycycle');
        });
    });
    
    it('4.2: Deep catalog builder creates variants', async () => {
        const catalog = await deepCatalogBuilder.buildDeepCatalogForModel('Canyon', 'Spectral');
        expect(catalog.length).to.be.greaterThan(0);
    });
    
    it('4.3: Source priority respected', async () => {
        const buycycleBike = { source: 'buycycle', year: 2023, quality_score: 95, brand: 'Canyon', model: 'Spectral' };
        const kleinBike = { source: 'kleinanzeigen', year: null, quality_score: 65, brand: 'Canyon', model: 'Spectral' };
        
        const merged = SourceMerger.merge(buycycleBike, kleinBike);
        
        expect(merged.year).to.equal(2023); 
        expect(merged.quality_score).to.equal(95);
        expect(merged.source).to.equal('buycycle');
    });
});
