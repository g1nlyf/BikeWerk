/**
 * PriceFormatter - Расчет и форматирование цен согласно CashflowLogic.md
 */

class PriceFormatter {
    constructor() {
        // Цены доставки
        this.DELIVERY_PRICES = {
            cargo: 170,
            ems: 220,
            premium_collective: 450,
            premium_individual: 600
        };

        // Курс EUR/RUB
        this.EUR_RUB_RATE = parseFloat(process.env.EUR_RUB_RATE || '96');
    }

    /**
     * Рассчитать сервисный сбор в зависимости от цены байка
     * @param {number} bikePrice - Цена байка в EUR
     * @returns {number}
     */
    calculateService(bikePrice) {
        if (bikePrice < 1500) return 250;
        if (bikePrice < 3500) return 400;
        if (bikePrice < 6000) return 600;
        return bikePrice * 0.10;
    }

    /**
     * Рассчитать страховые сборы
     * @param {number} bikePrice - Цена байка в EUR
     * @returns {number}
     */
    calculateInsurance(bikePrice) {
        return bikePrice * 0.025 + 40;
    }

    /**
     * Рассчитать финальную цену
     * @param {number} bikePrice - Цена байка в EUR
     * @param {string} deliveryOption - 'cargo' | 'ems' | 'premium_collective' | 'premium_individual'
     * @param {boolean} cargoInsurance - Нужна ли страховка груза (€40)
     * @returns {Object}
     */
    calculateFinalPrice(bikePrice, deliveryOption = 'cargo', cargoInsurance = false) {
        const delivery = this.DELIVERY_PRICES[deliveryOption] || this.DELIVERY_PRICES.cargo;
        const service = this.calculateService(bikePrice);
        const insurance = this.calculateInsurance(bikePrice);
        const cargoIns = cargoInsurance ? 40 : 0;

        const subtotal = bikePrice + delivery + service + insurance + cargoIns;
        const commission = subtotal * 0.07;
        const totalEur = subtotal + commission;
        const totalRub = Math.ceil(totalEur * this.EUR_RUB_RATE);
        const reserveRub = Math.ceil(totalRub * 0.02);

        return {
            bikePrice,
            delivery,
            deliveryOption,
            service,
            insurance,
            cargoInsurance: cargoIns,
            subtotal,
            commission,
            totalEur: Math.round(totalEur * 100) / 100,
            totalRub,
            reserveRub
        };
    }

    /**
     * Форматировать цену для отображения в боте
     * @param {number} bikePrice - Цена байка в EUR
     * @param {string} deliveryOption - Опция доставки
     * @returns {string}
     */
    formatPriceCard(bikePrice, deliveryOption = 'cargo') {
        const calc = this.calculateFinalPrice(bikePrice, deliveryOption, bikePrice >= 1500);

        const deliveryNames = {
            cargo: 'Cargo (20-24 дня)',
            ems: 'EMS (14-18 дней)',
            premium_collective: 'Premium сборный (25-30 дней)',
            premium_individual: 'Premium индивидуал (22-24 дня)'
        };

        return `
💰 <b>Цена байка:</b> €${bikePrice.toLocaleString('ru-RU')}
🚚 <b>Доставка ${deliveryNames[deliveryOption]}:</b> €${calc.delivery}
🔧 <b>Сервис BikeWerk:</b> €${calc.service}
🛡 <b>Страховые сборы:</b> €${calc.insurance.toFixed(2)}
${calc.cargoInsurance > 0 ? `📦 <b>Страховка груза:</b> €${calc.cargoInsurance}\n` : ''}
━━━━━━━━━━━━━━━━━━━━
<b>Subtotal:</b> €${calc.subtotal.toFixed(2)}
<b>Комиссия (7%):</b> €${calc.commission.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
<b>💳 К ОПЛАТЕ:</b> €${calc.totalEur} (<b>${calc.totalRub.toLocaleString('ru-RU')} ₽</b>)
<b>Резерв 2%:</b> ${calc.reserveRub.toLocaleString('ru-RU')} ₽
        `.trim();
    }

    /**
     * Краткая карточка цены (для списка /hot)
     * @param {number} bikePrice - Цена байка в EUR
     * @returns {string}
     */
    formatShortPrice(bikePrice) {
        const calc = this.calculateFinalPrice(bikePrice, 'cargo', bikePrice >= 1500);
        return `€${bikePrice} → <b>€${calc.totalEur}</b> (~${Math.ceil(calc.totalRub / 1000)}k ₽)`;
    }
}

module.exports = new PriceFormatter();
