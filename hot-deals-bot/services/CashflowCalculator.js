
/**
 * CashflowCalculator
 * Implements logic from docs/BusinessRules/CashflowLogic.md
 */
class CashflowCalculator {
    constructor() {
        this.EUR_RUB_RATE = 96; // Hardcoded fallback, should be updated from .env
    }

    calculate(bikePriceEur) {
        if (!bikePriceEur || bikePriceEur <= 0) {
            return {
                bikePrice: 0,
                totalEur: 0,
                totalRub: 0,
                details: {}
            };
        }

        // 1. Delivery (Fixed defaults based on MD)
        // MD says: Cargo: 170, EMS: 220, Premium: 450, 600
        // "Final Model" implies we sum up components.
        // We will use 170 (Cargo) as the base default if not specified.
        const deliveryCost = 170;

        // 2. Service Fee (Progressive scale from CashflowLogic.md)
        let serviceFee = 0;
        if (bikePriceEur < 1000) {
            serviceFee = 180;
        } else if (bikePriceEur < 1500) {
            serviceFee = 230;
        } else if (bikePriceEur < 2200) {
            serviceFee = 300;
        } else if (bikePriceEur < 3000) {
            serviceFee = 380;
        } else if (bikePriceEur < 4000) {
            serviceFee = 500;
        } else if (bikePriceEur < 5000) {
            serviceFee = 650;
        } else {
            serviceFee = bikePriceEur * 0.10;
        }

        // 3. Insurance Fees (2.5% + 40)
        const insuranceFees = (bikePriceEur * 0.025) + 40;

        // 4. Cargo Insurance (Optional - now €0 by default as per user request to "remove from mechanism")
        const cargoInsurance = 0;

        // 5. Options (Optional - default 0)
        const optionsCost = 0;

        // Subtotal
        const subtotal = bikePriceEur + deliveryCost + serviceFee + insuranceFees + cargoInsurance + optionsCost;

        // Payment Commission (7%)
        const paymentCommission = subtotal * 0.07;

        // Total EUR
        const totalEur = subtotal + paymentCommission;

        // Total RUB
        const totalRub = totalEur * this.EUR_RUB_RATE;

        return {
            bikePrice: bikePriceEur,
            totalEur: Math.ceil(totalEur),
            totalRub: Math.ceil(totalRub / 100) * 100, // Round to nearest 100
            details: {
                delivery: deliveryCost,
                service: serviceFee,
                insurance: insuranceFees,
                cargoInsurance: cargoInsurance,
                commission: paymentCommission
            }
        };
    }
}

module.exports = new CashflowCalculator();
