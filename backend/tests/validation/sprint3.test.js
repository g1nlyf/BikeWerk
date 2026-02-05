const path = require('path');
const { expect } = require('chai');

// Set env var BEFORE requiring DatabaseManager
const TEST_DB_PATH = path.resolve(__dirname, '../../database/eubike_test.db');
process.env.DB_PATH = TEST_DB_PATH;

const DatabaseManager = require('../../database/db-manager');
const ValuationService = require('../../src/services/ValuationService');

const dbManager = new DatabaseManager();
const db = dbManager.getDatabase();
// Use default internal DB manager (mysql-config) which has .query() method
// We rely on process.env.DB_PATH to ensure it opens the same DB file
const valuationService = new ValuationService();

describe('Sprint 3: Valuation Intelligence', () => {

  before(() => {
    // Clean up relevant tables if needed
    db.prepare("DELETE FROM market_history WHERE brand IN ('Canyon', 'YT', 'Evil')").run();
  });

  it('3.1: IQR outlier removal', async () => {
    // Add 10 Canyon Spectral 2023 bikes with prices
    const prices = [2000, 2100, 2200, 2300, 2400, 2500, 8000, 2600, 2700, 2800];
    const insert = db.prepare(`
      INSERT INTO market_history (brand, model, year, price_eur, quality_score, category) 
      VALUES ('Canyon', 'Spectral', 2023, ?, 90, 'Mountain')
    `);
    
    for (const price of prices) {
      insert.run(price);
    }
    
    const fmv = await valuationService.calculateFMV({
      brand: 'Canyon', 
      model: 'Spectral', 
      year: 2023,
      condition_grade: 'A' // Avoid penalty for pure FMV check
    });
    
    expect(fmv.fmv).to.be.within(2200, 2700);
  });

  it('3.2: Depreciation model fallback', async () => {
    // No data for 2022 or surrounding years (2021-2023)
    // Insert 2020 data (diff 2 years)
    const insert2020 = db.prepare(`
        INSERT INTO market_history (brand, model, year, price_eur, quality_score, category) 
        VALUES ('YT', 'Capra', 2020, 2000, 90, 'Mountain')
    `);
    for(let i=0; i<5; i++) insert2020.run();

    // Insert 2025 data (diff 3 years)
    const insert2025 = db.prepare(`
        INSERT INTO market_history (brand, model, year, price_eur, quality_score, category) 
        VALUES ('YT', 'Capra', 2025, 3000, 90, 'Mountain')
    `);
    for(let i=0; i<5; i++) insert2025.run();
    
    const result = await valuationService.calculateFMVWithDepreciation('YT', 'Capra', 2022);
    
    expect(result).to.not.be.null;
    expect(result.method).to.equal('depreciation');
  });

  it('3.3: Confidence levels accurate', async () => {
    // Model with 3 records -> MEDIUM (or HIGH?)
    const insertEvil = db.prepare(`
        INSERT INTO market_history (brand, model, year, price_eur, quality_score, category) 
        VALUES ('Evil', 'Following', 2023, 4000, 90, 'Mountain')
    `);
    for(let i=0; i<3; i++) insertEvil.run();
    
    const mediumFMV = await valuationService.calculateFMVWithDepreciation('Evil', 'Following', 2023);
    expect(mediumFMV.confidence).to.equal('high'); 
    
    // Model with 25 records
    const insertCanyon = db.prepare(`
        INSERT INTO market_history (brand, model, year, price_eur, quality_score, category) 
        VALUES ('Canyon', 'Spectral', 2023, 2500, 90, 'Mountain')
    `);
    for(let i=0; i<15; i++) insertCanyon.run();
    
    const highFMV = await valuationService.calculateFMVWithDepreciation('Canyon', 'Spectral', 2023);
    expect(highFMV.confidence).to.equal('high');
  });

});
