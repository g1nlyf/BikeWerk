
const fs = require('fs');
const path = require('path');
const FMVUrlBuilder = require('./FMVUrlBuilder');
const BikeflipUrlBuilder = require('./BikeflipUrlBuilder'); 
const KleinanzeigenFMVUrlBuilder = require('./KleinanzeigenFMVUrlBuilder');
const FMVCollector = require('./FMVCollector');

class FMVOrchestrator {
    constructor() {
        this.stateFile = path.resolve(__dirname, '../../state/fmv_collection_state.json');
        this.whitelist = [
            { brand: 'YT', model: 'Capra' },
            { brand: 'YT', model: 'Jeffsy' },
            { brand: 'YT', model: 'Tues' },
            { brand: 'YT', model: 'Decoy' },
            { brand: 'Specialized', model: 'Stumpjumper' },
            { brand: 'Specialized', model: 'Enduro' },
            { brand: 'Canyon', model: 'Spectral' },
            { brand: 'Canyon', model: 'Torque' },
            { brand: 'Santa Cruz', model: 'Megatower' },
            { brand: 'Santa Cruz', model: 'Nomad' }
        ];
    }

    async runFullCollection(yearRange = { start: 2018, end: 2025 }) {
        console.log('🚀 STARTING FULL FMV COLLECTION');
        console.log(`📅 Years: ${yearRange.start}-${yearRange.end}`);
        
        // 1. Generate Plan
        const plan = FMVUrlBuilder.generateCollectionPlan(this.whitelist, yearRange);
        console.log(`📋 Plan generated: ${plan.length} tasks`);

        // 2. Load State (Resume capability)
        // Not implemented fully for this sprint, simple iteration for now

        // 3. Execute
        const summary = {
            total: plan.length,
            processed: 0,
            records_collected: 0,
            errors: 0
        };

        for (const task of plan) {
            console.log(`\n⏳ Processing task ${summary.processed + 1}/${summary.total}...`);
            
            try {
                const stats = await FMVCollector.collect(task, 50);
                summary.records_collected += stats.collected;
                if (stats.errors > 0) summary.errors++;
            } catch (e) {
                console.error(`   ❌ Task Failed: ${e.message}`);
                summary.errors++;
            }

            summary.processed++;
            
            // Rate Limiting
            console.log('   💤 Cooling down (3s)...');
            await new Promise(r => setTimeout(r, 3000));
        }

        console.log('\n🏁 COLLECTION FINISHED');
        console.log(`📊 Total Records Collected: ${summary.records_collected}`);
        console.log(`❌ Errors: ${summary.errors}`);
    }

    async runTestCollection(brand, model, years) {
        console.log(`🧪 TEST RUN: ${brand} ${model} (${years.join(', ')})`);
        
        const testWhitelist = [{ brand, model }];
        // Need to adapt FMVUrlBuilder slightly or just loop manually here if years is array
        // FMVUrlBuilder takes { start, end }
        
        const plan = [];
        for (const year of years) {
            // Add Buycycle tasks
            plan.push(...FMVUrlBuilder.generateCollectionPlan(testWhitelist, { start: year, end: year }));
            // Add Bikeflip tasks
            plan.push(...BikeflipUrlBuilder.generateCollectionPlan(testWhitelist, { start: year, end: year }));
            // Add Kleinanzeigen tasks
            plan.push(...KleinanzeigenFMVUrlBuilder.generateCollectionPlan(testWhitelist, { start: year, end: year }));
        }

        for (const task of plan) {
            await FMVCollector.collect(task, 5); // Low limit for test
            await new Promise(r => setTimeout(r, 2000));
        }
        
        console.log('✅ TEST COMPLETE');
    }
}

module.exports = new FMVOrchestrator();
