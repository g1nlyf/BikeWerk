// @ts-check
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const priceCalculator = require('./PriceCalculatorService');

const DEFAULT_CONFIG = {
    marketingServiceRate: 0.08,
    realDelivery: 220,
    markupTable: [
        { min: 500, max: 1500, markup: 320 },
        { min: 1500, max: 2500, markup: 400 },
        { min: 2500, max: 3500, markup: 500 },
        { min: 3500, max: 5000, markup: 650 },
        { min: 5000, max: 7000, markup: 800 },
        { min: 7000, max: Infinity, markup: 1000 }
    ],
    volatilityThreshold: 0.015, // 1.5%
    apiUrls: [
        'https://api.exchangerate-api.com/v4/latest/EUR',
        'https://open.er-api.com/v6/latest/EUR'
    ]
};

class FinancialAgent {
    constructor(dbManager, config = {}) {
        this.db = dbManager;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentRate = null;
    }

    /**
     * Start the autonomous agent
     */
    start() {
        console.log('🤖 Financial Agent: Started');
        
        // Schedule: Every 4 hours
        cron.schedule('0 */4 * * *', async () => {
            console.log('🤖 Financial Agent: Running scheduled sync...');
            await this.syncLoop();
        });

        // Run immediately on startup
        this.syncLoop().catch(err => console.error('Financial Agent Startup Error:', err));
    }

    /**
     * Main sync loop
     */
    async syncLoop() {
        try {
            const newRate = await this.fetchCurrentRate();
            if (!newRate) {
                console.warn('⚠️ Financial Agent: Could not fetch rate. Skipping sync.');
                return;
            }

            const oldRate = await this.getLastRate();
            
            // Volatility Guard
            if (oldRate && Math.abs((newRate - oldRate) / oldRate) > this.config.volatilityThreshold) {
                await this.handleVolatilityAlert(newRate, oldRate);
            }

            await this.saveRateHistory(newRate);
            await this.updateSystemRate(newRate);
            await this.syncCatalogPrices(newRate);
            
            this.currentRate = newRate;
            console.log(`✅ Financial Agent: Sync complete. Rate: ${newRate}`);
        } catch (error) {
            console.error('💥 Financial Agent Error:', error.message);
            await this.logSystemError('FinancialAgent', error.message, error.stack);
            
            // Fallback to manual rate if needed
            await this.fallbackToManualRate();
        }
    }

    /**
     * Fetch EUR to RUB rate
     */
    async fetchCurrentRate() {
        // 1. Try OTP Bank (Priority) - DIRECT PARSING
        try {
            const { data } = await axios.get('https://www.otpbank.ru/retail/currency/', {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'max-age=0',
                    'Referer': 'https://www.google.com/'
                },
                timeout: 8000
            });
            const $ = cheerio.load(data);
            
            let eurRate = null;
            
            // Logic based on User Screenshot:
            // Find row containing 'EUR' or 'Евро'
            let targetRow = null;
            
            $('.currency-table__row').each((i, row) => {
                const text = $(row).text().toUpperCase();
                if (text.includes('EUR') || text.includes('ЕВРО')) {
                    targetRow = $(row);
                    return false; // break
                }
            });

            if (targetRow) {
                 // Find all result values in this row
                 const results = [];
                 targetRow.find('.currency-table__row-result').each((j, el) => {
                     const valText = $(el).text().replace(',', '.').trim();
                     const val = parseFloat(valText);
                     if (!isNaN(val) && val > 0) {
                         results.push(val);
                     }
                 });

                 // User requested the LARGER of the two (Sell Rate)
                 if (results.length > 0) {
                     eurRate = Math.max(...results);
                 }
            } else {
                // Fallback to strict index if text search fails (Row 1 is usually EUR)
                const eurRowStrict = $('.currency-table__row').eq(1);
                if (eurRowStrict.length > 0) {
                     const results = [];
                     eurRowStrict.find('.currency-table__row-result').each((j, el) => {
                         const valText = $(el).text().replace(',', '.').trim();
                         const val = parseFloat(valText);
                         if (!isNaN(val) && val > 0) {
                             results.push(val);
                         }
                     });
                     if (results.length > 0) {
                         eurRate = Math.max(...results);
                     }
                }
            }

            if (eurRate) {
                console.log(`✅ Financial Agent: Scraped OTP Bank rate: ${eurRate}`);
                return eurRate;
            }
        } catch (e) {
            console.warn(`⚠️ Financial Agent: Failed to scrape OTP Bank: ${e.message}`);
        }

        // 2. Fallback to API URLs (with Retail Spread)
        // OTP Bank Sell Rate is typically ~4-5% above market rate.
        // Current calibration: Market ~90.55, OTP ~94.50. Spread ~1.0436.
        const RETAIL_SPREAD = 1.0436;

        for (const url of this.config.apiUrls) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                if (response.data && response.data.rates && response.data.rates.RUB) {
                    const marketRate = response.data.rates.RUB;
                    const retailRate = parseFloat((marketRate * RETAIL_SPREAD).toFixed(2));
                    console.log(`⚠️ Financial Agent: Using Fallback API (Market: ${marketRate}, Retail: ${retailRate})`);
                    return retailRate;
                }
            } catch (e) {
                console.warn(`Failed to fetch from ${url}: ${e.message}`);
            }
        }
        return null;
    }

    /**
     * Get last stored rate from history or system settings
     */
    async getLastRate() {
        try {
            // Try history first
            const history = await this.db.query('SELECT rate FROM currency_history ORDER BY timestamp DESC LIMIT 1');
            if (history && history.length > 0) {
                return history[0].rate;
            }
            
            // Try settings
            const settings = await this.db.query('SELECT value FROM system_settings WHERE key = ?', ['eur_to_rub']);
            if (settings && settings.length > 0) {
                return Number(settings[0].value);
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }

    async saveRateHistory(rate) {
        await this.db.query(
            'INSERT INTO currency_history (rate, timestamp) VALUES (?, CURRENT_TIMESTAMP)',
            [rate]
        );
    }

    async updateSystemRate(rate) {
        await this.db.query(
            'INSERT INTO system_settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
            ['eur_to_rub', String(rate)]
        );
    }

    /**
     * Handle Critical Volatility
     */
    async handleVolatilityAlert(newRate, oldRate) {
        const change = ((newRate - oldRate) / oldRate * 100).toFixed(2);
        const msg = `CRITICAL_CURRENCY_FLUCTUATION: Rate changed by ${change}% (Old: ${oldRate}, New: ${newRate})`;
        console.error(`🚨 ${msg}`);
        
        await this.logSystemError('FinancialAgent', msg, 'VolatilityGuard');
        
        // In real system: send email/telegram
        // await notificationService.sendAdminAlert(msg);
    }

    async logSystemError(source, message, stack = '') {
        try {
            await this.db.query(
                'INSERT INTO system_logs (level, source, message, stack) VALUES (?, ?, ?, ?)',
                ['error', source, message, stack]
            );
        } catch (e) {
            console.error('Failed to log system error:', e);
        }
    }

    /**
     * Recalculate RUB prices for all bikes
     */
    async syncCatalogPrices(rate) {
        // Sync rate to PriceCalculator
        priceCalculator.EUR_RUB_RATE = rate;

        // Get all bikes with EUR price
        const bikes = await this.db.query('SELECT id, price_eur, price FROM bikes');
        
        let updatedCount = 0;
        
        for (const bike of bikes) {
            // Ensure we have a base EUR price. 
            // If price_eur is null, fallback to price (assuming it was EUR).
            const basePrice = bike.price_eur || bike.price;
            
            if (!basePrice) continue;

            // Use Unified Pricing Logic (PriceCalculatorService)
            // We match the frontend default: Cargo (170) + Insurance (4%)
            const calc = priceCalculator.calculate(basePrice, 'Cargo', true);
            const priceRub = calc.total_price_rub;

            // Update DB
            // We update price_rub AND ensure price_eur is set if it was missing
            await this.db.query(
                'UPDATE bikes SET price_rub = ?, price_eur = ? WHERE id = ?',
                [priceRub, basePrice, bike.id]
            );
            updatedCount++;
        }
        
        console.log(`💰 Smart Pricing: Updated ${updatedCount} bikes with rate ${rate} using PriceCalculatorService`);
    }

    async fallbackToManualRate() {
        console.log('⚠️ Switching to Manual Rate from settings...');
    }
}

module.exports = { FinancialAgent };
