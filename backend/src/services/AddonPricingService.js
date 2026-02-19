const priceCalculator = require('./PriceCalculatorService');

const PAYMENT_COMMISSION_RATE = Number(priceCalculator?.PAYMENT_COMMISSION_RATE || 0.07) || 0.07;
const BOOKING_RATE = Number(priceCalculator?.BOOKING_RATE || 0.02) || 0.02;

const ADDON_RULES = {
    personal_inspection: { type: 'fixed', value: 80 },
    extra_packaging: { type: 'fixed', value: 15 },
    video_call: { type: 'fixed', value: 15 },
    extra_photos: { type: 'per_unit', value: 2 },
    detailed_check: { type: 'fixed', value: 10 },
    extra_insurance: { type: 'percent_bike', value: 0.08 },
    customs_guarantee: { type: 'percent_total_rub', value: 0.04 }
};

function clampQty(rawQty) {
    const qty = Math.floor(Number(rawQty) || 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return Math.min(qty, 50);
}

function normalizeAddonId(rawId) {
    const id = String(rawId || '').trim();
    if (!id) return '';
    return id.replace(/[^a-z0-9_]/gi, '');
}

function normalizeAddons(input) {
    const list = [];
    if (Array.isArray(input)) {
        for (const row of input) {
            const id = normalizeAddonId(row?.id);
            const qty = clampQty(row?.qty);
            if (!id || qty <= 0) continue;
            list.push({ id, qty });
        }
    } else if (input && typeof input === 'object') {
        for (const [rawId, rawQty] of Object.entries(input)) {
            const id = normalizeAddonId(rawId);
            const qty = clampQty(rawQty);
            if (!id || qty <= 0) continue;
            list.push({ id, qty });
        }
    }

    const merged = new Map();
    for (const row of list) {
        merged.set(row.id, (merged.get(row.id) || 0) + row.qty);
    }

    return Array.from(merged.entries())
        .map(([id, qty]) => ({ id, qty: clampQty(qty) }))
        .filter((row) => row.qty > 0);
}

function round2(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Number(n.toFixed(2));
}

function calculateAddonTotals({ addons, bikePriceEur, baseTotalRub, exchangeRate }) {
    const normalizedAddons = normalizeAddons(addons);
    const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 96;
    const bikePrice = Number(bikePriceEur) > 0 ? Number(bikePriceEur) : 0;
    const baseRub = Number(baseTotalRub) > 0 ? Number(baseTotalRub) : 0;

    let totalEur = 0;
    let totalRub = 0;
    const lines = [];

    for (const addon of normalizedAddons) {
        const rule = ADDON_RULES[addon.id];
        if (!rule) continue;

        let lineEur = 0;
        let lineRub = 0;

        if (rule.type === 'fixed' || rule.type === 'per_unit') {
            lineEur = Number(rule.value || 0) * addon.qty;
            lineRub = Math.round(lineEur * rate);
        } else if (rule.type === 'percent_bike') {
            lineEur = bikePrice * Number(rule.value || 0) * addon.qty;
            lineRub = Math.round(lineEur * rate);
        } else if (rule.type === 'percent_total_rub') {
            lineRub = Math.round(baseRub * Number(rule.value || 0) * addon.qty);
            lineEur = rate > 0 ? lineRub / rate : 0;
        }

        lineEur = round2(lineEur);
        lineRub = Math.round(lineRub);

        totalEur += lineEur;
        totalRub += lineRub;
        lines.push({ id: addon.id, qty: addon.qty, price_eur: lineEur, price_rub: lineRub });
    }

    return {
        normalizedAddons,
        totalEur: round2(totalEur),
        totalRub: Math.round(totalRub),
        lines
    };
}

function calculateFinancialsWithAddons({ bikePriceEur, shippingMethod, exchangeRate, addons, cargoInsurance = true }) {
    const calc = priceCalculator.calculate(bikePriceEur, shippingMethod, cargoInsurance);
    const details = calc?.details || {};
    const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : Number(details.exchange_rate || 96) || 96;

    const baseSubtotalEur = Number(details.subtotal_eur || 0) || 0;
    const addonTotals = calculateAddonTotals({
        addons,
        bikePriceEur,
        baseTotalRub: Number(calc?.total_price_rub || 0),
        exchangeRate: rate
    });

    const subtotalWithAddonsEur = baseSubtotalEur + addonTotals.totalEur;
    const paymentCommissionEur = subtotalWithAddonsEur * PAYMENT_COMMISSION_RATE;
    const finalPriceEur = round2(subtotalWithAddonsEur + paymentCommissionEur);
    const totalPriceRub = Math.ceil(finalPriceEur * rate);
    const bookingAmountRub = Math.ceil(totalPriceRub * BOOKING_RATE);

    return {
        normalizedAddons: addonTotals.normalizedAddons,
        details: {
            ...details,
            exchange_rate: rate,
            addons_total_eur: addonTotals.totalEur,
            addons_total_rub: addonTotals.totalRub,
            addons_lines: addonTotals.lines,
            subtotal_with_addons_eur: round2(subtotalWithAddonsEur),
            payment_commission_eur: round2(paymentCommissionEur),
            final_price_eur: finalPriceEur,
            total_price_rub: totalPriceRub,
            booking_amount_rub: bookingAmountRub
        }
    };
}

module.exports = {
    normalizeAddons,
    calculateAddonTotals,
    calculateFinancialsWithAddons,
    PAYMENT_COMMISSION_RATE,
    BOOKING_RATE
};
