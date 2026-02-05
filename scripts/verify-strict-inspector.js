const fs = require('fs');
const path = require('path');
const gemini = require('../backend/src/services/geminiProcessor');

// Helper to convert file to data URI
function fileToDataUri(filePath) {
    const bitmap = fs.readFileSync(filePath);
    const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/webp';
    const base64 = bitmap.toString('base64');
    return `data:${mimeType};base64,${base64}`;
}

async function runTest() {
    console.log("=== STARTING STRICT INSPECTOR VERIFICATION ===");
    console.log("Testing Objective Inspector 4.0 Logic...");

    // Define paths to test bikes
    // Ideally we want one "clean" and one "dirty" to verify the spread.
    // Using ID10 and ID64 as samples from local fs.
    const bike1Dir = path.join(__dirname, '../backend/public/images/bikes/id10');
    const bike2Dir = path.join(__dirname, '../backend/public/images/bikes/id64');

    const getImages = (dir) => {
        try {
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .filter(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'))
                .slice(0, 4) // Take up to 4 images
                .map(f => path.join(dir, f));
        } catch (e) {
            console.error(`Could not read dir ${dir}:`, e.message);
            return [];
        }
    };

    const images1 = getImages(bike1Dir);
    const images2 = getImages(bike2Dir);

    if (images1.length === 0) {
        console.error(`No images found in ${bike1Dir}`);
    } else {
        console.log(`\n>>> ANALYZING BIKE 1 (ID10) [${images1.length} images] <<<`);
        try {
            const dataUris1 = images1.map(fileToDataUri);
            const result1 = await gemini.analyzeCondition(dataUris1, "Specialized Turbo Levo (Test)", "Used e-bike, check for wear.");
            console.log("VERDICT 1:");
            console.log(JSON.stringify(result1, null, 2));
        } catch (e) {
            console.error("Error analyzing Bike 1:", e.message);
        }
    }

    if (images2.length === 0) {
        console.error(`No images found in ${bike2Dir}`);
    } else {
        console.log(`\n>>> ANALYZING BIKE 2 (ID64) [${images2.length} images] <<<`);
        try {
            const dataUris2 = images2.map(fileToDataUri);
            const result2 = await gemini.analyzeCondition(dataUris2, "Canyon Spectral (Test)", "Trail bike, potential scratches.");
            console.log("VERDICT 2:");
            console.log(JSON.stringify(result2, null, 2));
        } catch (e) {
            console.error("Error analyzing Bike 2:", e.message);
        }
    }
}

runTest();
