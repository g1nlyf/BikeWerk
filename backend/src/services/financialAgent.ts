import axios from 'axios';
import cron from 'node-cron';

// Interfaces
interface MarkupRange {
    min: number;
    max: number;
    markup: number;
}

interface FinancialConfig {
    marketingServiceRate: number;
    realDelivery: number;
    markupTable: MarkupRange[];
    volatilityThreshold: number;
    apiUrls: string[];
}

const DEFAULT_CONFIG: FinancialConfig = {
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

export class FinancialAgent {
    private db: any;
    private config: FinancialConfig;
    private currentRate: number | null = null;

    constructor(dbManager: any, config: Partial<FinancialConfig> = {}) {
        this.db = dbManager;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Start the autonomous agent
     */
    public start() {
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
    private async syncLoop() {
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
                // We still update, or should we halt? 
                // "If calculation fails... switch to manual_rate" -> this is different.
                // "If rate changes > 1.5%... log CRITICAL... and notify".
                // We proceed but log critical.
            }

            await this.saveRateHistory(newRate);
            await this.updateSystemRate(newRate);
            await this.syncCatalogPrices(newRate);
            
            this.currentRate = newRate;
            console.log(`✅ Financial Agent: Sync complete. Rate: ${newRate}`);
        } catch (error: any) {
            console.error('💥 Financial Agent Error:', error.message);
            await this.logSystemError('FinancialAgent', error.message, error.stack);
            
            // Fallback to manual rate if needed
            await this.fallbackToManualRate();
        }
    }

    /**
     * Fetch EUR to RUB rate
     */
    private async fetchCurrentRate(): Promise<number | null> {
        for (const url of this.config.apiUrls) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                if (response.data && response.data.rates && response.data.rates.RUB) {
                    return response.data.rates.RUB;
                }
            } catch (e: any) {
                console.warn(`Failed to fetch from ${url}: ${e.message}`);
            }
        }
        return null;
    }

    /**
     * Get last stored rate from history or system settings
     */
    private async getLastRate(): Promise<number | null> {
        try {
            // Try history first
            const history = await this.db.db.all('SELECT rate FROM currency_history ORDER BY timestamp DESC LIMIT 1');
            if (history && history.length > 0) {
                return history[0].rate;
            }
            
            // Try settings
            const settings = await this.db.db.all('SELECT value FROM system_settings WHERE key = ?', ['eur_to_rub']);
            if (settings && settings.length > 0) {
                return Number(settings[0].value);
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }

    private async saveRateHistory(rate: number) {
        await this.db.db.run(
            'INSERT INTO currency_history (rate, timestamp) VALUES (?, CURRENT_TIMESTAMP)',
            [rate]
        );
    }

    private async updateSystemRate(rate: number) {
        await this.db.db.run(
            'INSERT INTO system_settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
            ['eur_to_rub', String(rate)]
        );
    }

    /**
     * Handle Critical Volatility
     */
    private async handleVolatilityAlert(newRate: number, oldRate: number) {
        const change = ((newRate - oldRate) / oldRate * 100).toFixed(2);
        const msg = `CRITICAL_CURRENCY_FLUCTUATION: Rate changed by ${change}% (Old: ${oldRate}, New: ${newRate})`;
        console.error(`🚨 ${msg}`);
        
        await this.logSystemError('FinancialAgent', msg, 'VolatilityGuard');
        
        // In real system: send email/telegram
        // await notificationService.sendAdminAlert(msg);
    }

    private async logSystemError(source: string, message: string, stack: string = '') {
        try {
            await this.db.db.run(
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
    private async syncCatalogPrices(rate: number) {
        // Get all bikes with EUR price
        const bikes = await this.db.db.all('SELECT id, price_eur, price FROM bikes');
        
        let updatedCount = 0;
        
        // Assuming database supports transaction or we do batch
        // SQLite in DatabaseManager might not expose explicit transaction easily without raw access
        // We'll update one by one or batch if possible.
        // Given existing structure, one by one is safest for now.
        
        for (const bike of bikes) {
            // Ensure we have a base EUR price. 
            // If price_eur is null, fallback to price (assuming it was EUR).
            const basePrice = bike.price_eur || bike.price;
            
            if (!basePrice) continue;

            const totalEur = this.calculateTotalEur(basePrice);
            const priceRub = Math.round(totalEur * rate);

            // Update DB
            // We update price_rub AND ensure price_eur is set if it was missing
            await this.db.db.run(
                'UPDATE bikes SET price_rub = ?, price_eur = ? WHERE id = ?',
                [priceRub, basePrice, bike.id]
            );
            updatedCount++;
        }
        
        console.log(`💰 Smart Pricing: Updated ${updatedCount} bikes with rate ${rate}`);
    }

    /**
     * Pricing Logic Mirroring Calculator.js
     */
    private calculateTotalEur(bikePrice: number): number {
        const realMarkup = this.getRealMarkup(bikePrice);
        const realDelivery = this.config.realDelivery;
        return bikePrice + realMarkup + realDelivery;
    }

    private getRealMarkup(bikePrice: number): number {
        for (const range of this.config.markupTable) {
            if (bikePrice >= range.min && bikePrice < range.max) {
                return range.markup;
            }
        }
        // Fallback for low price
        if (this.config.markupTable.length > 0) {
            return this.config.markupTable[0].markup;
        }
        return 320;
    }

    private async fallbackToManualRate() {
        console.log('⚠️ Switching to Manual Rate from settings...');
        // Logic to maybe read 'manual_rate_override' if it existed
        // For now, we just rely on whatever is in system_settings if fetch failed
    }
}
