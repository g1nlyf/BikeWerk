const fs = require('fs');
const path = require('path');
const KleinanzeigenParser = require('../telegram-bot/kleinanzeigen-parser');

const TEST_CASES = [
    {
        id: 1,
        url: 'https://www.kleinanzeigen.de/s-anzeige/canyon-mountainbike-grand-canyon-5-groesse-l-aus-2024/3285182014-217-2570',
        title: 'Canyon Mountainbike Grand Canyon 5 Größe L',
        price: '680 € VB',
        shippingText: '+ Versand ab 70,00 €',
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
        expected: {
            deliveryOption: 'available',
            isNegotiable: true,
            descriptionContains: 'Canyon Mountainbike – Größe L'
        }
    },
    {
        id: 2,
        url: 'https://www.kleinanzeigen.de/s-anzeige/canyon-strive-mountain-bike-fully/3284060830-217-9290',
        title: 'Canyon Strive Mountain Bike Fully',
        price: '950 € VB',
        shippingText: '+ Versand ab 4,89 €',
        description: `Gute Tag, 
 ich verkaufe mein Canyon Strive AL 2018, da ich es nicht mehr wirklich benutze. 
 Es ist in einem guten Zustand, aber natürlich ein paar wenige Gebrauchs Spuren. 
 Die Schaltung müsste allerdings eingestellt werden. 
 Auch der Dämpfer könnte mal wieder einen Service vertragen. 
 Falls Du Fragen oder Interesse hast schreib mir gerne :)`,
        expected: {
            deliveryOption: 'available',
            isNegotiable: true,
            descriptionContains: 'Gute Tag'
        }
    },
    {
        id: 3,
        url: 'https://www.kleinanzeigen.de/s-anzeige/ghost-riot-enduro-al-essential-2023-groesse-s-top/3267851699-217-8453',
        title: 'Ghost Riot Enduro AL Essential 2023',
        price: '1.499 € VB',
        shippingText: 'Nur Abholung',
        description: `Verkaufen das Ghost Riot Enduro AL Essential Fully in Gr. S 27,5 Zoll unseres Sohnes. Er ist rausgewachsen und tatsächlich sehr wenig damit gefahren. Gekauft haben wir es im März 2024. 
 
 Dieses Bike hat die Abfahrt im Auge! Dank des Aluminium-Rahmens mit SuperFit-Geometrie und TractionLink-Hinterbau lässt sich dieses Mountainbike durchaus bergauf pedalieren - aber mit der massiven 170mm-Gabel und einem performanten Stahlfeder-Dämpfer ist es gebaut für den Downhill. Haltbare SRAM-Bauteile und griffige Maxxis-Reifen bringen dich selbst die garstigsten Trails hinunter. Der Einstieg in die Enduro-Welt! 
 
 Federweg vorne 170mm 
 Federweg hinten 160mm 
 Schaltung SRAM GX Eagle 
 Mit absenkbarer Sattelstütze 
 
 Bei Fragen bitte gerne melden!`,
        expected: {
            deliveryOption: 'pickup-only',
            isNegotiable: true,
            descriptionContains: 'Verkaufen das Ghost Riot'
        }
    },
    {
        id: 4,
        url: 'https://www.kleinanzeigen.de/s-anzeige/trek-fuel-ex-9-8-women-s-groesse-m-carbon/3082088994-217-8599',
        title: 'Trek Fuel EX 9.8 Women\'s',
        price: '1.999 € VB',
        shippingText: 'Nur Abholung',
        description: `Leider muss ich aufgrund längerer Krankheit mein MTB verkaufen, ich konnte es die letzten Jahre durch meine schwere Knie Verletzung traurigerweise nicht fahren und finde es zu schade wenn’s nicht benutzt wird, ich habe es auch gebraucht gekauft. 
 Der Zustand ist wie den Bildern zu entnehmen sehr gut. 
  
 Wichtigsten Parts im Überblick: 
 Trek Fuel EX 9.8 von 2017 
 Neupreis: 4999 € 
 Rahmen: Trek OCLV Mountain Carbon 
 Größe: 18,5 Zoll entspricht M (Ich bin 168cm) 
 Schaltwerk: Shimano XT (2 x 11) 
 Bremsen: Shimano XT 
 Gabel: Fox 34 Float Performance 140 mm 
 Dämpfer: Fox Float Re- aktiv Performance 130 mm Sattelstütze: Bontrager Drop Line 125 mm Lenker: Bontrager Line Pro Carbon 750 mm Reifen: Bontrager XR3 Team Issue 29 Zoll v/h 
 Gewicht: 12,7 kg ohne Pedale. 
  
 Genaue Beschreibung findet ihr im link unten: 
 https://archive.trekbikes.com/za/en/2017/Trek/ fuel_ex_98_womens#/za/en/2017/Trek/ fuel_ex_98_womens/details 
  
 Testberichte: 
 https://m.pinkbike.com/news/trek-fuel-ex- 
  
 Meldet Euch gern bei weiteren Fragen.`,
        expected: {
            deliveryOption: 'pickup-only',
            isNegotiable: true,
            descriptionContains: 'Leider muss ich'
        }
    },
    {
        id: 5,
        url: 'https://www.kleinanzeigen.de/s-anzeige/focus-jam-6-8-seven-2020-fully-mtb-groesse-l-27-5-/3231031516-217-9043',
        title: 'Focus Jam 6.8 Seven 2020',
        price: '1.700 €',
        shippingText: 'Nur Abholung',
        description: `Ich verkaufe hier mein Focus Jam 6.8 SEVEN (Modelljahr 2020) in Rahmengröße L. 
 Ich bin das Rad liebend gerne gefahren, es hat mich nie im Stich gelassen – allerdings ist es mir mittlerweile etwas zu klein geworden, weshalb ich es nun schweren Herzens abgebe. 
 Das Rad ist in sehr gutem, gepflegtem Zustand, wurde regelmäßig gereinigt und gewartet. Es hat nur kleine, oberflächliche Gebrauchsspuren im Lack, die beim Mountainbiken nun einmal dazugehören. 
 Technisch ist alles in einwandfreiem Zustand. 
 
 Original Ausstattung: 
 - Rahmen: 6061 Aluminium, 150 mm F.O.L.D. Kinematik, BSA Tretlager, ISCG 05, 148x12 mm Steckachse, interne Kabelführung, Post Mount 180 mm 
 - Gabel: FOX 34 Float Rhythm 27,5”, Grip Remote, 110x15 mm, 44 mm Rake, 150 mm Federweg 
 - Dämpfer: FOX Float DPS Performance, 3-Position Lever, 200x57 mm, custom tune 
 - Federweg: 150 mm / 150 mm 
 - Schaltgruppe: Shimano Deore XT M8100, 12-fach 
 - Schalthebel: Shimano Deore XT M8100 
 - Schaltwerk: Shimano Deore XT M8100 
 - Kurbel: Shimano Deore XT FC-M8100, Hollowtech II 
 - Übersetzung: 32 Zähne vorne / 10–51 Zähne hinten 
 - Innenlager: BSA 
 - Lenker: BBB Ascension BHB-110, Aluminium, 780 mm, Rise 20 mm, Backsweep 9° 
 - Griffe: Race Face Gripper 
 - Vorbau: BBB Jumper BHS-137, 31,8 mm 
 - Steuersatz: Acros AZX-212 AH, 1 1/8”, tapered 
 - Sattelstütze: Kindshock Rage-i 180mm, 31,6 mm, absenkbar 
 - Sattel: FOCUS Trail SL 
 - Bremsen: Shimano XT M8120 (4-Kolben vorne) / M8100 (2-Kolben hinten) 
 - Bremsscheiben: 200 mm / 180 mm 
 - Laufräder: DT Swiss M1900, 27,5”, 584-30, 148x12 mm / 110x15 mm 
 - Reifen: Maxxis Minion DHF 2.5 3C EXO TR (vorne) / Maxxis Minion DHR II 2.4 Dual EXO TR (hinten) 
 - Farbe: Stone Blue 
 
 Erneuerte & getauschte Teile: 
 - Neue Kette (Shimano XT, ca. 300km gefahren) 
 - Neue original Bremsbeläge vorne & hinten 
 - Frische Reifen Maxxis Minion DHF 2.5 3C MaxxTerra EXO TR (vorne) / Maxis Minion DHR II 2.4 3C MaxxTerra EXO TR (hinten) (ca. 100km gefahren) 
 - Andere Griffe montiert – Originalgriffe unbenutzt, gebe ich gerne kostenlos mit 
 
 Zustand & Pflege: 
 - Regelmäßig gereinigt und gepflegt 
 - Gesamt Kilometer: 3000km 
 - Keine technischen Mängel 
 - Nur leichte Kratzer im Lack, keine Dellen oder strukturellen Schäden (alle Kratzer sind in den Fotos zu sehen) 
 - Sattel ist an der Seite aufgeplatzt (siehe Foto) 
 
 Fahreigenschaften: 
 Das JAM 6.8 SEVEN ist ein verspieltes, leicht manövrierbares Trail-Fully – perfekt für flowige Trails und lange Touren. Mit Pedalen 15 kg schwer. 
 Im Vergleich zur 29”-Variante (siehe Testbericht bei Enduro-Magazin) ist es etwas agiler und intuitiver zu fahren. 
 
 Sonstiges: 
 - Nur Abholung (kein Versand) 
 - Probefahrt nach Absprache möglich 
 - Privatverkauf – keine Garantie oder Rücknahme`,
        expected: {
            deliveryOption: 'pickup-only',
            isNegotiable: false,
            descriptionContains: 'Ich verkaufe hier mein Focus Jam'
        }
    }
];

// Helper to construct HTML
function createHtml(testCase) {
    return `
<!DOCTYPE html>
<html>
<head><title>${testCase.title}</title></head>
<body>
    <div id="viewad-main">
        <div class="boxedarticle--title">
            <h1 id="viewad-title">${testCase.title}</h1>
        </div>
        <div class="boxedarticle--price">
            <h2 id="viewad-price">${testCase.price}</h2>
        </div>
        
        <!-- Shipping Info Block (Simulated) -->
        <div class="aditem-main--middle--price-shipping--shipping">
            ${testCase.shippingText}
        </div>

        <div id="viewad-description-text" class="boxedarticle--description">
            <p>${testCase.description.replace(/\n/g, '<br/>')}</p>
        </div>
        
        <div class="boxedarticle--location">
            80331 München
        </div>
    </div>
</body>
</html>
    `;
}

async function runCalibration() {
    console.log('🧪 Starting Calibration on Real Link Scenarios...');
    const parser = new KleinanzeigenParser();
    
    // Override fetchHtmlContent to return mock
    parser.fetchHtmlContent = async (url) => {
        const testCase = TEST_CASES.find(tc => tc.url === url);
        if (testCase) {
            return createHtml(testCase);
        }
        return '';
    };

    let passed = 0;
    
    for (const testCase of TEST_CASES) {
        console.log(`\n🔍 Testing Case #${testCase.id}: ${testCase.title}`);
        try {
            const data = await parser.parseKleinanzeigenLink(testCase.url);
            
            // Checks
            let casePassed = true;
            
            // 1. Delivery
            if (data.deliveryOption !== testCase.expected.deliveryOption) {
                console.error(`   ❌ Delivery Mismatch: Expected '${testCase.expected.deliveryOption}', Got '${data.deliveryOption}'`);
                casePassed = false;
            } else {
                console.log(`   ✅ Delivery: ${data.deliveryOption}`);
            }

            // 2. Negotiable
            if (data.isNegotiable !== testCase.expected.isNegotiable) {
                console.error(`   ❌ Negotiable Mismatch: Expected ${testCase.expected.isNegotiable}, Got ${data.isNegotiable}`);
                casePassed = false;
            } else {
                console.log(`   ✅ Negotiable: ${data.isNegotiable}`);
            }

            // 3. Description
            if (!data.description.includes(testCase.expected.descriptionContains)) {
                console.error(`   ❌ Description NOT found or incomplete!`);
                console.log(`      Extracted start: ${data.description.substring(0, 50)}...`);
                casePassed = false;
            } else {
                console.log(`   ✅ Description found (${data.description.length} chars)`);
            }

            if (casePassed) passed++;

        } catch (e) {
            console.error(`   ❌ Error: ${e.message}`);
        }
    }

    console.log(`\n📊 Calibration Results: ${passed}/${TEST_CASES.length} Passed`);
    if (passed === TEST_CASES.length) {
        console.log('✨ All scenarios validated!');
    } else {
        console.error('⚠️ Calibration needed.');
        process.exit(1);
    }
}

runCalibration();
