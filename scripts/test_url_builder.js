const UnifiedHunter = require('../telegram-bot/unified-hunter');
// Mocking dependencies to avoid instantiation errors if any
// But UnifiedHunter constructor initializes DB etc. 
// We should be careful.
// UnifiedHunter constructor doesn't seem to await anything critical, but it creates DB instance.
// Let's just run it. If it fails due to env vars, we'll mock.

try {
    const hunter = new UnifiedHunter();

    console.log("--- Testing URL Builder ---");

    const cases = [
        {
            name: "User Example 1: Base (Canyon)",
            params: { brand: 'Canyon', priceMin: 500, priceMax: 1200 },
            expected: "https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/canyon/k0c217?seite={page}"
        },
        {
            name: "User Example 2: With Shipping",
            params: { brand: 'Canyon', priceMin: 500, priceMax: 1200, shipping: true },
            expected: "https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/canyon/k0c217+fahrraeder.versand_s:ja?seite={page}"
        },
        {
            name: "User Example 3: With Type (MTB)",
            params: { brand: 'Canyon', priceMin: 500, priceMax: 1200, type: 'mtb' },
            expected: "https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/canyon/k0c217+fahrraeder.type_s:mountainbike?seite={page}"
        },
        {
            name: "No Brand (Generic)",
            params: { priceMin: 500, priceMax: 1200, type: 'mtb' },
            expected: "https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1200/c217+fahrraeder.type_s:mountainbike?seite={page}"
        },
        {
            name: "Silent Collector (Pagination)",
            params: { brand: 'Canyon', priceMin: 500, priceMax: 1000, page: 2 },
            expected: "https://www.kleinanzeigen.de/s-fahrraeder/preis:500:1000/canyon/k0c217?seite=2"
        }
    ];

    let failed = 0;
    cases.forEach(c => {
        const url = hunter.constructUrl(c.params);
        if (url === c.expected) {
            console.log(`✅ ${c.name}: PASS`);
        } else {
            console.log(`❌ ${c.name}: FAIL`);
            console.log(`   Expected: ${c.expected}`);
            console.log(`   Actual:   ${url}`);
            failed++;
        }
    });

    if (failed === 0) console.log("\nALL TESTS PASSED");
    else console.log(`\n${failed} TESTS FAILED`);
    
    process.exit(0);

} catch (e) {
    console.error("Setup Error:", e);
}
