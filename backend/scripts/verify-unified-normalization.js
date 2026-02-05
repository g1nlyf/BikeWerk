const BuycyclePreprocessor = require('../src/services/BuycyclePreprocessor');
const KleinanzeigenPreprocessor = require('../src/services/KleinanzeigenPreprocessor');
const UnifiedNormalizer = require('../src/services/UnifiedNormalizer');

const assert = (condition, message) => {
    if (!condition) {
        console.error(`❌ ${message}`);
        process.exit(1);
    }
};

const buycycleHtml = `
    <html>
        <head>
            <script id="__NEXT_DATA__" type="application/json">
                {
                  "props": {
                    "pageProps": {
                      "product": {
                        "id": "bc777",
                        "title": "Specialized Status 140 2021",
                        "price": { "value": 2100 },
                        "year": 2021,
                        "frameSize": "M",
                        "condition": "Sehr gut",
                        "images": [{ "url": "https://img.buycycle.com/2.jpg" }],
                        "components": { "Brakes": "SRAM" }
                      }
                    }
                  }
                }
            </script>
        </head>
        <body></body>
    </html>
`;

const kleinHtml = `
    <html>
        <body>
            <h1 id="viewad-title">YT Capra 2019</h1>
            <div id="viewad-price">1.500 €</div>
            <div id="viewad-locality">Hamburg</div>
            <div id="viewad-description-text">Rahmengröße L, guter Zustand.</div>
            <div id="viewad-contact">Gewerblich</div>
            <div data-adid="112233"></div>
            <img src="https://img.kleinanzeigen.de/2.jpg" />
        </body>
    </html>
`;

const buycyclePre = BuycyclePreprocessor.preprocess({ html: buycycleHtml, url: 'https://buycycle.com/bike/bc777' });
assert(buycyclePre.title === 'Specialized Status 140 2021', 'Buycycle title not extracted');
assert(buycyclePre.price === 2100, 'Buycycle price not extracted');
assert(buycyclePre.frame_size === 'M', 'Buycycle frame size not extracted');

const kleinPre = KleinanzeigenPreprocessor.preprocess({ html: kleinHtml, url: 'https://www.kleinanzeigen.de/s-anzeige/x/112233-123-456' });
assert(kleinPre.title === 'YT Capra 2019', 'Kleinanzeigen title not extracted');
assert(kleinPre.price === 1500, 'Kleinanzeigen price not extracted');
assert(kleinPre.location === 'Hamburg', 'Kleinanzeigen location not extracted');
assert(kleinPre.seller_type === 'commercial', 'Kleinanzeigen seller type not extracted');

const runNormalization = async () => {
    const unified = await UnifiedNormalizer.normalize({ html: kleinHtml, url: 'https://www.kleinanzeigen.de/s-anzeige/x/112233-123-456' }, 'kleinanzeigen', { useGemini: false });
    assert(unified.meta.source_platform === 'kleinanzeigen', 'UnifiedNormalizer source mismatch');
    assert(unified.media.main_image, 'UnifiedNormalizer main image missing');
    assert(unified.meta.completeness_score !== undefined, 'Completeness score missing');
    console.log('✅ verify-unified-normalization.js passed');
};

runNormalization();
