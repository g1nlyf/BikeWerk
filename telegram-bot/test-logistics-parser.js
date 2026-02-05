const KleinanzeigenParser = require('./kleinanzeigen-parser');
const parser = new KleinanzeigenParser();

// Mock HTML for testing (since we might get blocked or have no active links)
const mockHtmlShipping = `
<html>
    <body>
        <div class="boxedarticle--details">
            <span class="boxedarticle--price">1.500 €</span>
            <span class="boxedarticle--details--shipping">Versand möglich</span>
        </div>
        <div id="viewad-description-text">Great bike, shipping available.</div>
    </body>
</html>
`;

const mockHtmlPickup = `
<html>
    <body>
        <div class="boxedarticle--details">
            <span class="boxedarticle--price">1.200 €</span>
            <span class="boxedarticle--details--shipping">Nur Abholung</span>
        </div>
        <div id="viewad-description-text">Pickup only in Berlin.</div>
    </body>
</html>
`;

async function test() {
    console.log('🧪 Running Test 1: Logistics Detection');

    // Test 1: Mock Shipping
    console.log('\n--- Case 1: Shipping Available (Mock) ---');
    const res1 = parser.extractBikeData(mockHtmlShipping, 'http://mock.com/1');
    console.log(`Result: ${res1.deliveryOption}`);
    if (res1.deliveryOption === 'available') console.log('✅ PASS');
    else console.log('❌ FAIL');

    // Test 2: Mock Pickup
    console.log('\n--- Case 2: Pickup Only (Mock) ---');
    const res2 = parser.extractBikeData(mockHtmlPickup, 'http://mock.com/2');
    console.log(`Result: ${res2.deliveryOption}`);
    if (res2.deliveryOption === 'pickup-only') console.log('✅ PASS');
    else console.log('❌ FAIL');

    // Optional: Try Real URL if provided (commented out to avoid blocks in CI/CD)
    // const realUrl = '...';
    // await parser.parseKleinanzeigenLink(realUrl);
}

test();
