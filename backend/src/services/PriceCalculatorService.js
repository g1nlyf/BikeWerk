/**
 * BikeWerk Price Calculator Service
 * Pricing source of truth for backend.
 *
 * Formula (docs/BusinessRules/CashflowLogic.md):
 * - Service Fee: progressive fixed brackets up to 5000 EUR, then 10%
 * - Insurance Fees: bike_price * 2.5% + 40 EUR
 * - Cargo Insurance: optional 40 EUR
 * - Subtotal: bike + delivery + service + insurance_fees + cargo_insurance
 * - Payment Commission: subtotal * 7%
 * - Total: subtotal + payment_commission
 */

class PriceCalculatorService {
    constructor() {
        this.EUR_RUB_RATE = 96;
        this.fetchExchangeRate();
        this.MIN_BIKE_PRICE_EUR = 500;
        this.MAX_BIKE_PRICE_EUR = 5000;

        this.SHIPPING_RATES = {
            Cargo: 170,
            EMS: 220,
            PremiumGroup: 450,
            PremiumIndividual: 600
        };

        this.SERVICE_BRACKETS = [
            { limit: 1000, value: 180 },
            { limit: 1500, value: 230 },
            { limit: 2200, value: 300 },
            { limit: 3000, value: 380 },
            { limit: 4000, value: 500 },
            { limit: 5000, value: 650 }
        ];
        this.SERVICE_PERCENT_ABOVE_MAX = 0.10;

        this.INSURANCE_FEE_RATE = 0.025;
        this.INSURANCE_FEE_FIXED = 40;
        this.CARGO_INSURANCE = 40;
        this.PAYMENT_COMMISSION_RATE = 0.07;
        this.BOOKING_RATE = 0.02;
    }

    async fetchExchangeRate() {
        try {
            console.log('💱 Fetching EUR/RUB exchange rate...');
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
            if (response.ok) {
                const data = await response.json();
                if (data.rates && data.rates.RUB) {
                    this.EUR_RUB_RATE = Math.ceil(data.rates.RUB);
                    console.log(`✅ Exchange rate updated: 1 EUR = ${this.EUR_RUB_RATE} RUB`);
                }
            }
        } catch (error) {
            console.error('❌ Failed to fetch exchange rate, using fallback (96):', error.message);
        }
    }

    calculateServiceFeeEur(bikePriceEur) {
        const price = Number(bikePriceEur);
        if (!Number.isFinite(price) || price <= 0) return 0;

        for (const bracket of this.SERVICE_BRACKETS) {
            if (price <= bracket.limit) return bracket.value;
        }

        return price * this.SERVICE_PERCENT_ABOVE_MAX;
    }

    /**
     * @param {number} bikePriceEur
     * @param {string} shippingOption Cargo | EMS | PremiumGroup | PremiumIndividual
     * @param {boolean} cargoInsurance include +40 EUR cargo insurance
     * @returns {{ total_price_rub: number, booking_amount_rub: number, details: object }}
     */
    calculate(bikePriceEur, shippingOption = 'Cargo', cargoInsurance = false) {
        const bikePrice = Number(bikePriceEur);
        const shippingCostEur = this.SHIPPING_RATES[shippingOption] || 170;

        const serviceFeeEur = this.calculateServiceFeeEur(bikePrice);
        const insuranceFeesEur = bikePrice * this.INSURANCE_FEE_RATE + this.INSURANCE_FEE_FIXED;
        const cargoInsuranceEur = cargoInsurance ? this.CARGO_INSURANCE : 0;

        const subtotalEur = bikePrice + shippingCostEur + serviceFeeEur + insuranceFeesEur + cargoInsuranceEur;
        const paymentCommissionEur = subtotalEur * this.PAYMENT_COMMISSION_RATE;
        const totalEur = subtotalEur + paymentCommissionEur;

        const totalRub = Math.ceil(totalEur * this.EUR_RUB_RATE);
        const bookingRub = Math.ceil(totalRub * this.BOOKING_RATE);

        return {
            total_price_rub: totalRub,
            booking_amount_rub: bookingRub,
            details: {
                bike_price_eur: Number(bikePrice.toFixed(2)),
                shipping_cost_eur: Number(shippingCostEur.toFixed(2)),
                service_fee_eur: Number(serviceFeeEur.toFixed(2)),
                insurance_fees_eur: Number(insuranceFeesEur.toFixed(2)),
                cargo_insurance_eur: Number(cargoInsuranceEur.toFixed(2)),
                subtotal_eur: Number(subtotalEur.toFixed(2)),
                payment_commission_eur: Number(paymentCommissionEur.toFixed(2)),
                // Legacy-compatible fields consumed by CRM/booking flows.
                warehouse_fee_eur: 0,
                margin_total_eur: Number(serviceFeeEur.toFixed(2)),
                exchange_rate: this.EUR_RUB_RATE,
                shipping_method: shippingOption,
                final_price_eur: Number(totalEur.toFixed(2))
            }
        };
    }

    /**
     * Legacy compatibility.
     */
    calculateLegacy(bikePriceEur, shippingOption = 'Cargo', insuranceIncluded = true) {
        return this.calculate(bikePriceEur, shippingOption, insuranceIncluded);
    }
}

module.exports = new PriceCalculatorService();
