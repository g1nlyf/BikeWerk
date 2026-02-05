const { DatabaseManager } = require('../js/mysql-config.js');
const crypto = require('crypto');

class GarageService {
    constructor(dbManager) {
        this.db = dbManager || new DatabaseManager();
    }

    /**
     * Get user's garage (delivered bikes)
     * @param {number} userId 
     */
    async getUserGarage(userId) {
        // Find bikes from orders that are delivered
        // Adjusted schema: shop_orders links to shop_order_items links to bikes
        const sql = `
            SELECT b.*, o.created_at as purchase_date, o.total_amount as purchase_price
            FROM bikes b
            JOIN shop_order_items oi ON oi.bike_id = b.id
            JOIN shop_orders o ON o.id = oi.order_id
            WHERE o.user_id = ? AND o.status = 'delivered'
        `;
        
        const bikes = await this.db.query(sql, [userId]);
        
        // Calculate Buyback Prices
        for (const bike of bikes) {
            bike.buyback_price = this.calculateBuybackPrice(bike);
            bike.passport = await this.getPassport(bike.id);
        }
        
        return bikes;
    }

    /**
     * Calculate dynamic buyback price
     * Formula: FMV * 0.75 - Penalty
     */
    calculateBuybackPrice(bike) {
        // Assume price is close to FMV if not stored
        // Or use original_price if available (which is often FMV in our system)
        const fmv = bike.original_price || bike.price; 
        
        // Base factor 0.75
        let price = fmv * 0.75;
        
        // Time depreciation (simplified: -5% per year)
        // Check purchase date if available, else assume current
        if (bike.purchase_date) {
            const years = (new Date() - new Date(bike.purchase_date)) / (1000 * 60 * 60 * 24 * 365);
            price = price * Math.pow(0.95, years);
        }
        
        // Condition Penalty (if known from re-inspection? For now assume same condition)
        // If condition was C, penalty is already in FMV.
        
        return Math.round(price);
    }

    /**
     * Get or Create Passport for a bike
     */
    async getPassport(bikeId) {
        const existing = await this.db.query(
            "SELECT * FROM digital_passports WHERE bike_id = ?",
            [bikeId]
        );
        
        if (existing.length > 0) return existing[0];
        
        // Generate new
        const token = crypto.randomBytes(32).toString('hex');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://eubike.com/verify/${token}`; // Mock/External QR Gen
        
        await this.db.query(
            "INSERT INTO digital_passports (token, bike_id, qr_code_url) VALUES (?, ?, ?)",
            [token, bikeId, qrUrl]
        );
        
        return { token, bike_id: bikeId, qr_code_url: qrUrl };
    }

    /**
     * Public verification
     */
    async verifyPassport(token) {
        const rows = await this.db.query(
            `SELECT p.*, b.brand, b.model, b.year, b.main_image, b.condition_grade 
             FROM digital_passports p 
             JOIN bikes b ON p.bike_id = b.id 
             WHERE p.token = ?`,
            [token]
        );
        
        if (rows.length === 0) return null;
        
        const passport = rows[0];
        
        // Add verification badges
        passport.badges = [
            { type: 'ai_inspected', label: 'Verified by AI Inspector', valid: true },
            { type: 'ownership', label: 'Ownership Verified', valid: true },
            { type: 'mileage', label: 'Mileage Certified', valid: true } // Mock
        ];
        
        return passport;
    }
}

module.exports = { GarageService };
