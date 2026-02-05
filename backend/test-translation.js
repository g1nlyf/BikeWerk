
const axios = require('axios');

const testTexts = [
    "Verkaufe mein sehr gut erhaltenes Mountainbike. Das Fahrrad hat ein Shimano XT Schaltwerk und eine RockShox Federgabel. Der Rahmen ist aus Carbon. Nur Abholung.",
    "Biete hier ein Rennrad der Marke Cube an. Es ist in einem top Zustand. Bremsen wurden frisch entlüftet. Reifen sind neu.",
    "E-Bike Bosch CX Motor, 625Wh Akku, kaum gefahren. Rahmengröße L. Neupreis war 4500 Euro."
];

async function testTranslation() {
    console.log("Testing Translation...");
    for (const text of testTexts) {
        try {
            console.log(`\nOriginal: ${text}`);
            const response = await axios.post('http://localhost:8082/api/translate', {
                q: text,
                source: 'de',
                target: 'ru'
            });
            console.log(`Translated: ${response.data.translatedText}`);
        } catch (error) {
            console.error("Error:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        }
    }
}

testTranslation();
