const UnifiedHunter = require('./unified-hunter');
const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('../src/js/mysql-config');

async function runVerify() {
    const logDir = path.resolve(__dirname, '../logs/verify_10');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    // Hijack console.log to write to file AND stdout
    const logFile = fs.createWriteStream(path.join(logDir, 'full_run.log'));
    const originalLog = console.log;
    console.log = (...args) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        logFile.write(msg + '\n');
        originalLog.apply(console, args);
    };

    try {
        console.log('🧪 Starting 10-Bike Catalog Verification Run...');
        
        // We need to run UnifiedHunter. 
        // We will use 'limit: 10' and 'returnBikes: true' to get the processed bikes.
        // We rely on UnifiedHunter's internal logic to collect and save.
        
        const hunter = new UnifiedHunter({
            logger: (msg) => console.log(`[HUNTER] ${msg}`)
        });

        // Run for 10 bikes
        const result = await hunter.run({
            mode: 'gap', // Use 'gap' or 'full' to trigger collection
            limit: 10,
            returnBikes: true,
            sources: ['both'] // Buycycle + Kleinanzeigen
        });

        console.log(`\n📦 Processing Result: ${result.bikes ? result.bikes.length : 0} bikes returned.`);

        // Save result bikes to individual logs
        if (result.bikes && result.bikes.length > 0) {
            console.log(`\n📂 Creating detailed logs for ${result.bikes.length} bikes in ${logDir}...`);
            for (const bike of result.bikes) {
                // Use ID if available, else model name
                // Note: result.bikes are the objects BEFORE saving? Or after?
                // UnifiedHunter returns `collected` which contains normalized bikes.
                // They might not have ID if not saved yet?
                // But UnifiedHunter saves them inside the loop.
                // However, the returned array is `targetCollected`.
                
                const safeName = (bike.basic_info?.model || 'unknown').replace(/[^a-z0-9]/gi, '_');
                const bikeDir = path.join(logDir, `bike_${safeName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
                fs.mkdirSync(bikeDir);
                
                fs.writeFileSync(path.join(bikeDir, 'unified_data.json'), JSON.stringify(bike, null, 2));
                
                const summary = [
                    `Brand: ${bike.basic_info?.brand}`,
                    `Model: ${bike.basic_info?.model}`,
                    `Price: ${bike.pricing?.price} ${bike.pricing?.currency}`,
                    `Quality Score: ${bike.quality_score}`,
                    `Source: ${bike.meta?.source_platform} (${bike.meta?.source_url})`,
                    `Condition: ${bike.condition?.score} / ${bike.condition?.grade}`,
                    `Specs: ${Object.keys(bike.specs || {}).length} items`
                ].join('\n');
                
                fs.writeFileSync(path.join(bikeDir, 'summary.txt'), summary);
                
                if (bike.media?.gallery) {
                    fs.writeFileSync(path.join(bikeDir, 'photos.txt'), bike.media.gallery.join('\n'));
                }
            }
        }

        console.log('\n✅ Verification Run Complete.');
        console.log(`Logs available at: ${logDir}`);

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        console.log = originalLog;
        logFile.end();
    }
}

runVerify();
