const GeminiProcessor = require('../telegram-bot/gemini-processor');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../telegram-bot/.env') });

// Mock data for the 5 ground truth cases
const testCases = [
    {
        name: 'Case 1: Canyon Grand Canyon',
        input: {
            title: 'Canyon Mountainbike "Grand Canyon 5" Größe L aus 2024',
            price: 680,
            description: `Canyon Mountainbike – Größe L – top Zustand, kaum gefahren!
Verkaufe mein Canyon Mountainbike in Rahmengröße L welches ich letztes Jahr gekauft habe. Das Bike ist in sehr gutem Zustand und wurde insgesamt nur ca. 150 km gefahren. Entsprechend minimal sind die Gebrauchsspuren – technisch wie optisch nahezu neuwertig.

Ausstattung & Zustand:
Leichter, hochwertiger Rahmen (Größe L)
Shimano Deore Schaltung und kraftvolle Scheibenbremsen
Federung arbeitet sauber und ohne Geräusche
Schwalbe Reifen mit sehr gutem Profil
Keine Stürze, keine Defekte, regelmäßig gepflegt
Das Bike ist sofort fahrbereit – perfekt für Trails, Allround-Touren oder den Alltag.
Abholung bevorzugt.
Bei Fragen oder Interesse einfach melden – Probefahrt möglich.`,
            brand: 'Canyon',
            model: 'Grand Canyon 5',
            category: 'Mountainbikes',
            isNegotiable: true,
            deliveryOption: 'pickup-only',
            location: 'Lohne (Oldenburg)',
            condition: 'Gebraucht',
            attributes: ['Art: Herren', 'Typ: Mountainbikes'],
            sellerName: 'TestSeller1',
            sourceAdId: '111111',
            originalUrl: 'https://test.url/1'
        },
        expected: {
            frameSize: ['L', 'L (19-20")', 'L (18.5-19.5")'], // Allow slight variations
            year: 2024,
            deliveryOption: 'pickup-only',
            isBike: true
        }
    },
    {
        name: 'Case 2: Canyon Strive',
        input: {
            title: 'Canyon Strive Mountain Bike / Fully',
            price: 950,
            description: `Gute Tag,
ich verkaufe mein Canyon Strive AL 2018, da ich es nicht mehr wirklich benutze.
Es ist in einem guten Zustand, aber natürlich ein paar wenige Gebrauchs Spuren.
Die Schaltung müsste allerdings eingestellt werden.
Auch der Dämpfer könnte mal wieder einen Service vertragen.
Falls Du Fragen oder Interesse hast schreib mir gerne :)`,
            brand: 'Canyon',
            model: 'Strive AL',
            category: 'Mountainbikes',
            isNegotiable: true,
            deliveryOption: 'available', // From +Versand 4,89
            location: 'Stuttgart',
            condition: 'Gebraucht',
            attributes: [],
            sellerName: 'TestSeller2',
            sourceAdId: '222222',
            originalUrl: 'https://test.url/2'
        },
        expected: {
            year: 2018,
            deliveryOption: 'available',
            isBike: true
        }
    },
    {
        name: 'Case 3: Ghost Riot Enduro',
        input: {
            title: 'Ghost Riot Enduro Al Essential 2023 Größe S Top',
            price: 1499,
            description: `Verkaufen das Ghost Riot Enduro AL Essential Fully in Gr. S 27,5 Zoll unseres Sohnes. Er ist rausgewachsen und tatsächlich sehr wenig damit gefahren. Gekauft haben wir es im März 2024.
Dieses Bike hat die Abfahrt im Auge! Dank des Aluminium-Rahmens mit SuperFit-Geometrie und TractionLink-Hinterbau lässt sich dieses Mountainbike durchaus bergauf pedalieren - aber mit der massiven 170mm-Gabel und einem performanten Stahlfeder-Dämpfer ist es gebaut für den Downhill. Haltbare SRAM-Bauteile und griffige Maxxis-Reifen bringen dich selbst die garstigsten Trails hinunter. Der Einstieg in die Enduro-Welt!
Federweg vorne 170mm
Federweg hinten 160mm
Schaltung SRAM GX Eagle
Mit absenkbarer Sattelstütze
Bei Fragen bitte gerne melden!`,
            brand: 'Ghost',
            model: 'Riot Enduro Al Essential',
            category: 'Mountainbikes',
            isNegotiable: true,
            deliveryOption: 'pickup-only',
            location: 'Leinfelden-Echterdingen',
            condition: 'Gebraucht',
            attributes: [],
            sellerName: 'TestSeller3',
            sourceAdId: '333333',
            originalUrl: 'https://test.url/3'
        },
        expected: {
            frameSize: ['S'],
            wheelDiameter: ['27.5', '27.5"', '27,5'],
            year: 2023, // Model year
            discipline: ['Enduro', 'Downhill'], // Could be either based on text
            isBike: true
        }
    },
    {
        name: 'Case 4: Trek Fuel EX',
        input: {
            title: 'Trek Fuel EX 9.8 Women‘s Größe M Carbon',
            price: 1999,
            description: `Leider muss ich aufgrund längerer Krankheit mein MTB verkaufen...
Wichtigsten Parts im Überblick:
Trek Fuel EX 9.8 von 2017
Neupreis: 4999 €
Rahmen: Trek OCLV Mountain Carbon
Größe: 18,5 Zoll entspricht M (Ich bin 168cm)
Schaltwerk: Shimano XT (2 x 11)
Bremsen: Shimano XT
Gabel: Fox 34 Float Performance 140 mm
Dämpfer: Fox Float Re- aktiv Performance 130 mm
...`,
            brand: 'Trek',
            model: 'Fuel EX 9.8',
            category: 'Mountainbikes',
            isNegotiable: true,
            deliveryOption: 'pickup-only',
            location: 'Wangen',
            condition: 'Gebraucht',
            attributes: [],
            sellerName: 'TestSeller4',
            sourceAdId: '444444',
            originalUrl: 'https://test.url/4'
        },
        expected: {
            frameSize: ['M', '18.5"', '18,5'],
            year: 2017,
            isBike: true
        }
    },
    {
        name: 'Case 5: Focus Jam',
        input: {
            title: 'Focus Jam 6.8 SEVEN 2020 – Fully MTB, Größe L, 27,5”',
            price: 1700,
            description: `Ich verkaufe hier mein Focus Jam 6.8 SEVEN (Modelljahr 2020) in Rahmengröße L.
Ich bin das Rad liebend gerne gefahren...
Original Ausstattung:
- Rahmen: 6061 Aluminium...
- Gabel: FOX 34 Float Rhythm 27,5”...
- Schaltgruppe: Shimano Deore XT M8100, 12-fach...`,
            brand: 'Focus',
            model: 'Jam 6.8 SEVEN',
            category: 'Mountainbikes',
            isNegotiable: false,
            deliveryOption: 'pickup-only',
            location: 'Waiblingen',
            condition: 'Gebraucht',
            attributes: [],
            sellerName: 'TestSeller5',
            sourceAdId: '555555',
            originalUrl: 'https://test.url/5'
        },
        expected: {
            frameSize: ['L'],
            year: 2020,
            isBike: true
        }
    }
];

const gp = new GeminiProcessor(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');

async function runTests() {
    console.log('🧪 Starting Semantic Enrichment Tests (Gemini)...');
    
    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        console.log(`\n--------------------------------------------------`);
        console.log(`Testing ${test.name}...`);
        
        try {
            const result = await gp.enrichBikeData(test.input);
            console.log('Gemini Output:', JSON.stringify(result, null, 2));

            let casePassed = true;
            
            // Check Frame Size
            if (test.expected.frameSize) {
                const fs = String(result.frameSize);
                const allowed = Array.isArray(test.expected.frameSize) ? test.expected.frameSize : [test.expected.frameSize];
                // Flexible check: 'M' matches 'M', '18.5"' matches '18.5', etc.
                const match = allowed.some(a => fs.includes(a.replace(/[^0-9a-zA-Z]/g, '')) || fs === a);
                if (!match) {
                    console.error(`❌ Frame Size Mismatch: Expected one of [${allowed}], Got "${fs}"`);
                    casePassed = false;
                } else {
                    console.log(`✅ Frame Size: ${fs}`);
                }
            }

            // Check Year
            if (test.expected.year) {
                if (result.year !== test.expected.year) {
                    console.error(`❌ Year Mismatch: Expected ${test.expected.year}, Got ${result.year}`);
                    casePassed = false;
                } else {
                    console.log(`✅ Year: ${result.year}`);
                }
            }

            // Check Delivery
            if (test.expected.deliveryOption) {
                if (result.deliveryOption !== test.expected.deliveryOption) {
                    console.error(`❌ Delivery Mismatch: Expected ${test.expected.deliveryOption}, Got ${result.deliveryOption}`);
                    casePassed = false;
                } else {
                    console.log(`✅ Delivery: ${result.deliveryOption}`);
                }
            }

            // Check isBike
            if (result.isBike !== true) {
                console.error(`❌ isBike is false!`);
                casePassed = false;
            } else {
                console.log(`✅ isBike: true`);
            }

            if (casePassed) {
                console.log(`🎉 ${test.name} PASSED`);
                passed++;
            } else {
                console.log(`💥 ${test.name} FAILED`);
                failed++;
            }

        } catch (e) {
            console.error(`❌ Exception in ${test.name}:`, e);
            failed++;
        }
        
        // Wait to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n==================================================`);
    console.log(`Tests Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

runTests();
