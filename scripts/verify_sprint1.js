const priceCalculator = require('../backend/src/services/PriceCalculatorService');

function test(name, input, expected) {
    const result = priceCalculator.calculate(input.price, input.shipping, input.insurance);
    console.log(`\n--- Test: ${name} ---`);
    console.log(`Input: Price=${input.price}, Shipping=${input.shipping}, Ins=${input.insurance}`);
    console.log(`Result:`, JSON.stringify(result.details, null, 2));
    console.log(`Total RUB: ${result.total_price_rub}`);
    console.log(`Booking RUB: ${result.booking_amount_rub}`);
}

// Test 1: Example from Prompt (Modified for updated Cargo rate 170 vs 220)
// 1000 EUR Bike, Cargo (170), Insurance (Yes)
test('Standard Bike (1000 EUR)', { price: 1000, shipping: 'Cargo', insurance: true }, {});

// Test 2: High Value Bike (>6000 EUR)
// 7000 EUR Bike, Premium (650), Insurance (Yes)
test('Super Bike (7000 EUR)', { price: 7000, shipping: 'Premium', insurance: true }, {});

console.log('\n✅ Verification Script Completed');
