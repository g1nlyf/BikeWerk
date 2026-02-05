class PriceCalculatorService {
    constructor() {
        this.EUR_RUB_RATE = 105; // Default fallback
        this.fetchExchangeRate();

        this.SHIPPING_RATES = {
            'Cargo': 170,
            'EMS': 220,
            'Premium': 650
        };
        // Margin brackets
        this.MARGIN_BRACKETS = [
            { limit: 1500, value: 250 },
            { limit: 3500, value: 400 },
            { limit: 6000, value: 600 }
        ];
        this.MARGIN_PERCENT_ABOVE_6000 = 0.10;
        
        this.PAYMENT_COMMISSION_RATE = 0.07;
        this.WAREHOUSE_FEE = 80;
        this.INSURANCE_RATE = 0.04;
        this.BOOKING_RATE = 0.02;
    }

    async fetchExchangeRate() {
        try {
            console.log('💱 Fetching EUR/RUB exchange rate...');
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
            if (response.ok) {
                const data = await response.json();
                if (data.rates && data.rates.RUB) {
                    this.EUR_RUB_RATE = Math.ceil(data.rates.RUB); // Round up for safety
                    console.log(`✅ Exchange rate updated: 1 EUR = ${this.EUR_RUB_RATE} RUB`);
                }
            }
        } catch (error) {
            console.error('❌ Failed to fetch exchange rate, using fallback (105):', error.message);
        }
    }

    /**
     * Calculate full price breakdown
     * @param {number} bikePriceEur 
     * @param {string} shippingOption - 'Cargo', 'EMS', 'Premium'
     * @param {boolean} insuranceIncluded 
     * @returns {Object} { total_price_rub, booking_amount_rub, details }
     */
    calculate(bikePriceEur, shippingOption = 'Cargo', insuranceIncluded = true) {
        bikePriceEur = Number(bikePriceEur);
        const shippingCostEur = this.SHIPPING_RATES[shippingOption] || 170;
        
        // 1. Calculate Margin (M_agent)
        let mAgent = 0;
        if (bikePriceEur < 1500) {
            mAgent = 250;
        } else if (bikePriceEur < 3500) {
            mAgent = 400;
        } else if (bikePriceEur < 6000) {
            mAgent = 600;
        } else {
            mAgent = bikePriceEur * this.MARGIN_PERCENT_ABOVE_6000;
        }

        // 2. Breakdown Components
        // F_transfer: (P_bike + S_option) * 0.07
        const fTransfer = (bikePriceEur + shippingCostEur) * this.PAYMENT_COMMISSION_RATE;
        
        // F_warehouse: 80 EUR (deducted from M_agent)
        const fWarehouse = this.WAREHOUSE_FEE;
        
        // F_service: Remainder of M_agent
        // If M_agent is less than 80, this would be negative, but let's assume business logic prevents this 
        // or we just take the hit (but for these price ranges, 250 > 80, so it's safe).
        const fService = Math.max(0, mAgent - fWarehouse);

        // Insurance
        let insuranceCostEur = 0;
        if (insuranceIncluded) {
            insuranceCostEur = bikePriceEur * this.INSURANCE_RATE;
        }

        // 3. Total Price (EUR)
        // P_final = P_bike + S_option + Ins + F_transfer + F_warehouse + F_service
        // Note: F_warehouse + F_service = M_agent.
        // So this is effectively: P_bike + S_option + Ins + F_transfer + M_agent
        const totalEur = bikePriceEur + shippingCostEur + insuranceCostEur + fTransfer + fWarehouse + fService;

        // 4. Convert to RUB
        const totalRub = Math.ceil(totalEur * this.EUR_RUB_RATE);
        
        // 5. Booking Deposit (2% of Total RUB)
        const bookingRub = Math.ceil(totalRub * this.BOOKING_RATE);

        return {
            total_price_rub: totalRub,
            booking_amount_rub: bookingRub,
            details: {
                bike_price_eur: bikePriceEur,
                shipping_cost_eur: shippingCostEur,
                insurance_cost_eur: insuranceCostEur,
                payment_commission_eur: Number(fTransfer.toFixed(2)), // F_transfer
                warehouse_fee_eur: Number(fWarehouse.toFixed(2)),     // F_warehouse
                service_fee_eur: Number(fService.toFixed(2)),         // F_service
                margin_total_eur: Number(mAgent.toFixed(2)),
                exchange_rate: this.EUR_RUB_RATE,
                shipping_method: shippingOption,
                final_price_eur: Number(totalEur.toFixed(2))
            }
        };
    }
}

module.exports = new PriceCalculatorService();
