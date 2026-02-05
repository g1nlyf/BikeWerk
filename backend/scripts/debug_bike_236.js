
const { DatabaseManager } = require('../src/js/mysql-config');
const { calculatePriceBreakdown } = require('../src/services/PriceCalculatorService'); // Assume this exists or I'll reimplement the logic here

const db = new DatabaseManager();

async function run() {
    await db.initialize();
    
    // 1. Fetch bike data
    const bike = (await db.query('SELECT * FROM bikes WHERE id = 236'))[0];
    
    if (!bike) {
        console.error('Bike 236 not found!');
        return;
    }

    console.log('--- Bike 236 Raw Data ---');
    console.log('ID:', bike.id);
    console.log('Title:', bike.name);
    console.log('Price (EUR) [price_eur or price]:', bike.price_eur || bike.price);
    console.log('Price (RUB) [price_rub]:', bike.price_rub);
    console.log('Shipping Option:', bike.shipping_option);
    console.log('Guaranteed Pickup:', bike.guaranteed_pickup);
    console.log('Triad ID:', bike.triad_id);
    console.log('Location:', bike.location || bike.city);

    // 2. Fetch system rate
    const settings = await db.query('SELECT value FROM system_settings WHERE key = "eur_to_rub"');
    const systemRate = settings.length > 0 ? parseFloat(settings[0].value) : 105;
    console.log('System Rate (DB):', systemRate);
    
    const TARGET_RATE = 94.5;
    console.log('Target Rate (Manual):', TARGET_RATE);

    // 3. Logic Recreation
    const basePriceEur = bike.price_eur || bike.price;
    
    // Margin Logic (from Pricing Service / Frontend)
    let mAgent = 0;
    if (basePriceEur < 1500) mAgent = 250;
    else if (basePriceEur < 3500) mAgent = 400;
    else if (basePriceEur < 6000) mAgent = 600;
    else mAgent = basePriceEur * 0.10;

    const shippingCost = 170; // Cargo
    const insuranceCost = basePriceEur * 0.04;
    const fTransfer = (basePriceEur + shippingCost) * 0.07;
    const fWarehouse = 80;
    const fService = Math.max(0, mAgent - fWarehouse);

    const totalEur = basePriceEur + shippingCost + insuranceCost + fTransfer + fWarehouse + fService;
    const totalRub = Math.ceil(totalEur * TARGET_RATE);
    
    console.log('--- Calculation (Rate 94.5) ---');
    console.log('Base EUR:', basePriceEur);
    console.log('Margin:', mAgent);
    console.log('Shipping:', shippingCost);
    console.log('Insurance:', insuranceCost);
    console.log('Transfer (7%):', fTransfer);
    console.log('Warehouse:', fWarehouse);
    console.log('Service:', fService);
    console.log('Total EUR:', totalEur);
    console.log('Total RUB (Calculated):', totalRub);

    console.log('--- Discrepancy Check ---');
    console.log('Catalog Price (User reported): 231,941');
    console.log('Detail Price (User reported): 238,556');
    console.log('Difference vs Calc:', totalRub - 238556);

    // Logistics Logic
    let isShippingAvailable, isGuaranteedPickup, isLocalLot;
    if (bike.triad_id) {
        const tid = Number(bike.triad_id);
        isShippingAvailable = tid === 1;
        isGuaranteedPickup = tid === 2;
        isLocalLot = tid === 3;
    } else {
        isShippingAvailable = !bike.shipping_option || bike.shipping_option === 'available' || bike.shipping_option === 'unknown';
        isGuaranteedPickup = !isShippingAvailable && !!bike.guaranteed_pickup;
        isLocalLot = !isShippingAvailable && !isGuaranteedPickup;
    }
    
    console.log('--- Logistics Status ---');
    console.log('Is Shipping Available:', isShippingAvailable);
    console.log('Is Guaranteed Pickup:', isGuaranteedPickup);
    console.log('Is Local Lot:', isLocalLot);

}

run().catch(console.error);
