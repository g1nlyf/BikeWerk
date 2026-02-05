
const { FinancialAgent } = require('../src/services/financialAgent');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Mock DB for testing
const mockDb = {
    query: async () => [],
    db: {
        all: async () => [],
        run: async () => {}
    }
};

async function test() {
    console.log('🧪 Testing Financial Agent Rate Fetching...');
    
    const agent = new FinancialAgent(mockDb);
    
    try {
        console.log('Attempting to fetch rate from OTP Bank...');
        const rate = await agent.fetchCurrentRate();
        
        if (rate) {
            console.log(`✅ Success! Fetched Rate: ${rate}`);
        } else {
            console.error('❌ Failed to fetch rate.');
        }
    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

test();
