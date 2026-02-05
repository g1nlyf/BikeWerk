const fs = require('fs');
const path = require('path');
const FMVUrlBuilder = require('../src/services/FMVUrlBuilder');
const BikeflipUrlBuilder = require('../src/services/BikeflipUrlBuilder');
const KleinanzeigenFMVUrlBuilder = require('../src/services/KleinanzeigenFMVUrlBuilder');
const FMVCollector = require('../src/services/FMVCollector');

// Configs
const WHITELIST_PATH = path.resolve(__dirname, '../config/fmv-whitelist.json');
const PLAN_PATH = path.resolve(__dirname, '../logs/collection-plan.json');

// Utils
function loadWhitelist() {
    return JSON.parse(fs.readFileSync(WHITELIST_PATH, 'utf8'));
}

function savePlan(plan) {
    fs.writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2));
}

function loadPlan() {
    if (fs.existsSync(PLAN_PATH)) {
        return JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
    }
    return null;
}

// 1. Generate Plan
function generatePlan() {
    console.log('🏗️ Generating Collection Plan...');
    const whitelist = loadWhitelist();
    const tasks = [];

    const whitelistFlat = [];
    whitelist.brands.forEach(b => {
        b.models.forEach(m => {
            whitelistFlat.push({ brand: b.brand, model: m.model });
        });
    });

    const years = whitelist.years;
    const limits = whitelist.recordsPerSource;

    // Years range object for builders
    const yearRange = { start: Math.min(...years), end: Math.max(...years) };

    // Buycycle Tasks
    const buycycleTasks = FMVUrlBuilder.generateCollectionPlan(whitelistFlat, yearRange);
    
    // Bikeflip Tasks
    const bikeflipTasks = BikeflipUrlBuilder.generateCollectionPlan(whitelistFlat, yearRange);
    
    // Kleinanzeigen Tasks
    const kleinanzeigenTasks = KleinanzeigenFMVUrlBuilder.generateCollectionPlan(whitelistFlat, yearRange);

    // Interleave tasks for equal distribution
    const maxLen = Math.max(buycycleTasks.length, bikeflipTasks.length, kleinanzeigenTasks.length);
    for (let i = 0; i < maxLen; i++) {
        if (i < buycycleTasks.length) {
            buycycleTasks[i].recordsTarget = limits.buycycle;
            buycycleTasks[i].status = 'pending';
            buycycleTasks[i].source = 'buycycle';
            tasks.push(buycycleTasks[i]);
        }
        if (i < bikeflipTasks.length) {
            bikeflipTasks[i].recordsTarget = limits.bikeflip;
            bikeflipTasks[i].status = 'pending';
            bikeflipTasks[i].source = 'bikeflip';
            tasks.push(bikeflipTasks[i]);
        }
        if (i < kleinanzeigenTasks.length) {
            kleinanzeigenTasks[i].recordsTarget = limits.kleinanzeigen;
            kleinanzeigenTasks[i].status = 'pending';
            kleinanzeigenTasks[i].source = 'kleinanzeigen';
            tasks.push(kleinanzeigenTasks[i]);
        }
    }

    const plan = {
        generatedAt: new Date().toISOString(),
        totalTasks: tasks.length,
        completedTasks: 0,
        tasks: tasks
    };

    savePlan(plan);
    console.log(`✅ Plan generated: ${tasks.length} tasks.`);
    return plan;
}

// 2. Execute Plan
async function executePlan() {
    let plan = loadPlan();
    if (!plan) {
        plan = generatePlan();
    }

    const pending = plan.tasks.filter(t => t.status === 'pending');
    console.log(`🚀 Starting execution. Pending tasks: ${pending.length}/${plan.totalTasks}`);

    let processed = 0;
    
    for (const task of pending) {
        console.log(`\n👉 Task ${processed + 1}/${pending.length} [${task.source.toUpperCase()}] ${task.brand} ${task.model} ${task.year}`);
        
        try {
            const result = await FMVCollector.collect(task, task.recordsTarget);
            
            // Update Task
            task.status = 'completed';
            task.result = result;
            task.completedAt = new Date().toISOString();
            
            // Save Plan Progress
            plan.completedTasks++;
            savePlan(plan);

            // Rate Limit
            console.log('   💤 Cooling down (3s)...');
            await new Promise(r => setTimeout(r, 3000));

        } catch (e) {
            console.error(`   ❌ Task Failed: ${e.message}`);
            // Don't mark as completed, allow retry later? Or mark 'failed'?
            // For now, simple crash resistance means we just skip saving 'completed'
            // But to avoid infinite loop on bad URL, maybe mark failed
            task.status = 'failed';
            task.error = e.message;
            savePlan(plan);
        }
        processed++;
    }

    console.log('\n🏁 Execution Finished.');
}

// Run
(async () => {
    try {
        await executePlan();
    } catch (e) {
        console.error('❌ FATAL:', e);
    }
})();