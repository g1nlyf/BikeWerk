const axios = require('axios');
const path = require('path');
const { DatabaseManager } = require('../backend/src/js/mysql-config.js');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const API_URL = 'http://localhost:8082/api/garage';
const DB_PATH = path.join(__dirname, '../backend/database/eubike.db');

async function main() {
    console.log('🚲 Starting Post-Sales & Garage Verification...');
    
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    // 1. Setup Data: Create a delivered order for user 1
    // Need a bike first
    console.log('\n🛠️ Setting up test data...');
    
    // Check if bike 1 exists, if not create
    let bikeId = 1;
    const bike = await db.get("SELECT * FROM bikes WHERE id = ?", [bikeId]);
    if (!bike) {
        // Insert dummy bike
        const res = await db.run(`
            INSERT INTO bikes (name, brand, model, price, category, description, is_active)
            VALUES ('Canyon Ultimate', 'Canyon', 'Ultimate CF SL', 2500, 'Road', 'Full carbon road bike with Ultegra', 1)
        `);
        bikeId = res.lastID;
        console.log(`Created test bike #${bikeId}`);
    } else {
        // Update description to be rich for AI
        await db.run("UPDATE bikes SET description = 'Full carbon road bike with Shimano Ultegra and carbon wheels' WHERE id = ?", [bikeId]);
    }

    // Insert delivered order
    await db.run("DELETE FROM shop_orders WHERE user_id = 1 AND status = 'delivered'");
    
    // Check if order_items table exists, or if we use shop_order_items
    // Based on previous debugging, shop_orders doesn't have bike_id, but shop_order_items does.
    
    // Create order
    const orderRes = await db.run(`
        INSERT INTO shop_orders (user_id, status, total_amount, order_number, shipping_address, created_at)
        VALUES (1, 'delivered', 2500, 'TEST-GARAGE-001', 'Test Address', datetime('now', '-1 year'))
    `);
    const orderId = orderRes.lastID;

    // Create order item
    await db.run(`
        INSERT INTO shop_order_items (order_id, bike_id, unit_price, total_price)
        VALUES (?, ?, 2500, 2500)
    `, [orderId, bikeId]);
    
    console.log(`✅ Created DELIVERED order #${orderId} for Bike #${bikeId}.`);

    // 2. Test Garage Dashboard
    console.log('\n🏠 Testing Virtual Garage...');
    try {
        const res = await axios.get(`${API_URL}/user/1`);
        const garage = res.data;
        
        console.log(`Garage has ${garage.length} bikes.`);
        if (garage.length > 0) {
            const b = garage[0];
            console.log(`- ${b.brand} ${b.model}`);
            console.log(`  Purchase Price: ${b.purchase_price}€`);
            console.log(`  Current Buyback Price: ${b.buyback_price}€ (Dynamic!)`);
            console.log(`  Passport Token: ${b.passport?.token}`);
            
            if (b.buyback_price < b.purchase_price) {
                console.log('✅ Buyback price calculation works (Depreciation applied).');
            } else {
                console.warn('⚠️ Buyback price weird equal or higher?');
            }
            
            // 3. Verify Passport
            if (b.passport?.token) {
                console.log('\n🎫 Verifying Passport...');
                const pRes = await axios.get(`${API_URL}/passport/${b.passport.token}`);
                const passport = pRes.data;
                console.log(`✅ Passport Verified for ${passport.brand} ${passport.model}`);
                console.log(`  Badges: ${passport.badges.map(x => x.label).join(', ')}`);
            } else {
                console.error('❌ Passport not generated in garage view.');
            }
        } else {
            console.error('❌ Garage is empty!');
        }
    } catch (e) {
        console.error('❌ Garage Test Failed:', e.message);
    }

    // 4. Test Smart Upsell
    console.log('\n🎁 Testing Smart Upsell Engine (Gemini)...');
    try {
        const res = await axios.get(`${API_URL}/upsell/${bikeId}`);
        const data = res.data;
        
        console.log(`Intro: "${data.intro}"`);
        console.log('Recommendations:');
        data.recommendations.forEach(rec => {
            console.log(`- ${rec.name} (${rec.price}€)`);
            console.log(`  Reason: ${rec.reason}`);
        });
        
        if (data.recommendations.length > 0) {
            console.log('✅ Smart Upsell returned recommendations.');
        } else {
            console.warn('⚠️ No recommendations returned (Gemini might have failed or no match).');
        }
        
    } catch (e) {
        console.error('❌ Upsell Test Failed:', e.message);
    }

    await db.close();
    console.log('\n✨ Verification Complete!');
    process.exit(0);
}

main().catch(console.error);
