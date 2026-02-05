const { expect } = require('chai');
const BuycyclePreprocessor = require('../../src/services/BuycyclePreprocessor');
const KleinanzeigenPreprocessor = require('../../src/services/KleinanzeigenPreprocessor');

describe('Preprocessors', () => {
    it('Buycycle preprocesses __NEXT_DATA__ and components', () => {
        const html = `
            <html>
                <head>
                    <script id="__NEXT_DATA__" type="application/json">
                        {
                          "props": {
                            "pageProps": {
                              "product": {
                                "id": "bc123",
                                "title": "Specialized Status 160 2022",
                                "price": { "value": 2500 },
                                "year": 2022,
                                "frameSize": "L",
                                "condition": "Sehr gut",
                                "images": [{ "url": "https://img.buycycle.com/1.jpg" }],
                                "components": { "Groupset": "SRAM GX" }
                              }
                            }
                          }
                        }
                    </script>
                </head>
                <body>
                    <h1>Fallback Title</h1>
                    <table>
                        <tr><td>Fork</td><td>RockShox</td></tr>
                    </table>
                </body>
            </html>
        `;
        const result = BuycyclePreprocessor.preprocess({ html, url: 'https://buycycle.com/bike/bc123' });
        expect(result.title).to.equal('Specialized Status 160 2022');
        expect(result.price).to.equal(2500);
        expect(result.frame_size).to.equal('L');
        expect(result.condition_status).to.equal('very_good');
        expect(result.components).to.have.property('Groupset');
        expect(result.images[0]).to.include('buycycle.com');
        expect(result.source_platform).to.equal('buycycle');
        expect(result.source_ad_id).to.equal('bc123');
    });

    it('Kleinanzeigen preprocesses HTML fields', () => {
        const html = `
            <html>
                <body>
                    <h1 id="viewad-title">Canyon Spectral AL 6.0</h1>
                    <div id="viewad-price">1.999 €</div>
                    <div id="viewad-locality">Berlin</div>
                    <div id="viewad-description-text">Guter Zustand, Größe L, 2021.</div>
                    <div id="viewad-contact">Privat</div>
                    <div data-adid="998877"></div>
                    <img src="https://img.kleinanzeigen.de/1.jpg" />
                </body>
            </html>
        `;
        const result = KleinanzeigenPreprocessor.preprocess({ html, url: 'https://www.kleinanzeigen.de/s-anzeige/abc/998877-123-456' });
        expect(result.title).to.equal('Canyon Spectral AL 6.0');
        expect(result.price).to.equal(1999);
        expect(result.location).to.equal('Berlin');
        expect(result.description).to.include('Guter Zustand');
        expect(result.seller_type).to.equal('private');
        expect(result.source_platform).to.equal('kleinanzeigen');
        expect(result.source_ad_id).to.equal('998877');
        expect(result.images.length).to.be.greaterThan(0);
    });
});
