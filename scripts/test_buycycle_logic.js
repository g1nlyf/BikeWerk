const BuycycleParser = require('../telegram-bot/BuycycleParser');
const cheerio = require('cheerio');

async function testLogic() {
    const parser = new BuycycleParser();
    
    // Mock HTML with __NEXT_DATA__
    const mockData = {
        props: {
            pageProps: {
                product: {
                    name: "Specialized Demo Race",
                    brand: { name: "Specialized" },
                    model: { name: "Demo Race" },
                    year: 2023,
                    price: 4500,
                    condition: "very_good",
                    size: "S3",
                    description: "Top condition, ready to race.",
                    images: [{ url: "img1.jpg" }, { url: "img2.jpg" }],
                    location: { city: "Munich" },
                    components: {
                        groupset: "SRAM X01 DH",
                        fork: "Ohlins DH38",
                        shock: "Ohlins TTX",
                        wheels: "Roval"
                    }
                }
            }
        }
    };

    const mockHtml = `
        <html>
            <body>
                <h1>Specialized Demo</h1>
                <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(mockData)}</script>
            </body>
        </html>
    `;

    // Mock _fetch to return this HTML
    parser._fetch = async () => mockHtml;

    console.log('🧪 Testing Buycycle Parser Logic...');
    const result = await parser.parseDetail('https://buycycle.com/test');
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.title === "Specialized Demo Race" && result.features.fork === "Ohlins DH38") {
        console.log('✅ Logic Test Passed!');
    } else {
        console.log('❌ Logic Test Failed');
    }
}

testLogic();