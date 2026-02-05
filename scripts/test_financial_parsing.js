const { FinancialAgent } = require('../backend/src/services/financialAgent');
const axios = require('axios');
const cheerio = require('cheerio');

// Mock DB Manager
const dbManager = {
    query: async (sql, params) => {
        return [];
    }
};

// Mock Axios with User's HTML snippet (or closest approximation)
// We need to test if the regex/selector logic works on the real structure.
// Since we can't fully mock the exact HTML without copying it all, 
// we will try to run the real request first (via proxy if configured in env or agent).
// If that fails, we use a mock.

async function test() {
    console.log("Starting FinancialAgent Test...");
    const agent = new FinancialAgent(dbManager);
    
    // 1. Test Fetch Logic
    console.log("Fetching Rate...");
    const rate = await agent.fetchCurrentRate();
    console.log(`Fetched Rate: ${rate}`);
    
    if (rate && rate > 90) {
        console.log("✅ Rate seems valid (matches expected ~94.5 range)");
    } else {
        console.log("❌ Rate invalid or not found.");
    }

    // 2. Test Mock HTML (to ensure parsing logic is robust even if network fails)
    console.log("\nTesting Parsing Logic with Mock HTML...");
    const mockHtml = `
    <div class="currency-table__row">
        <div class="currency-table__row-item">USD</div>
        <div class="currency-table__row-result">71.00</div>
        <div class="currency-table__row-result">85.00</div>
    </div>
    <div class="currency-table__row">
        <div class="currency-table__row-item">EUR / Евро</div>
        <div class="currency-table__row-result">86.50</div>
        <div class="currency-table__row-result">94.50</div>
    </div>
    `;
    
    const $ = cheerio.load(mockHtml);
    let eurRate = null;
    let targetRow = null;
    
    $('.currency-table__row').each((i, row) => {
        const text = $(row).text().toUpperCase();
        if (text.includes('EUR') || text.includes('ЕВРО')) {
            targetRow = $(row);
            return false;
        }
    });

    if (targetRow) {
         const results = [];
         targetRow.find('.currency-table__row-result').each((j, el) => {
             const valText = $(el).text().replace(',', '.').trim();
             const val = parseFloat(valText);
             if (!isNaN(val) && val > 0) results.push(val);
         });
         if (results.length > 0) eurRate = Math.max(...results);
    }

    console.log(`Mock Parse Result: ${eurRate}`);
    if (eurRate === 94.5) {
        console.log("✅ Parsing Logic Correct: Extracted 94.50");
    } else {
        console.log(`❌ Parsing Logic Failed. Expected 94.50, got ${eurRate}`);
    }
}

test();
