const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { open } = require('sqlite');

const API_URL = 'http://localhost:8082/api/euphoria';
const DB_PATH = path.join(__dirname, '../backend/database/eubike.db');

async function main() {
    console.log('🚲 Starting Euphoria Flow Verification...');

    // 1. Create Test Order directly in DB
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    // Clean up old test order
    await db.run("DELETE FROM shop_orders WHERE order_number = 'TEST-EUPHORIA-001'");

    const result = await db.run(`
        INSERT INTO shop_orders (
            user_id, order_number, status, 
            total_amount, shipping_address, urgency_level, reservation_expires_at
        ) VALUES (
            1, 'TEST-EUPHORIA-001', 'pending',
            1500, 'Test Address', 'normal', datetime('now', '+24 hours')
        )
    `);
    
    const orderId = result.lastID;
    console.log(`✅ Created test order ID: ${orderId}`);
    
    // 2. Test Status Flow
    const statuses = ['pending', 'paid', 'hunting', 'inspection', 'packing', 'shipped', 'delivered'];
    
    for (const status of statuses) {
        console.log(`\n--- Testing Status: ${status} ---`);
        
        // Update status via API (simulating system update)
        try {
            await axios.post(`${API_URL}/update-status`, { orderId, status });
        } catch (e) {
            console.error(`❌ Failed to update status to ${status}:`, e.message);
            if (e.response) console.error(e.response.data);
            continue;
        }

        // Check Tracker
        try {
            const res = await axios.get(`${API_URL}/track/${orderId}`);
            const data = res.data;
            
            console.log(`Emotional Status: ${data.emotional_status} (${data.icon})`);
            console.log(`Title: ${data.title}`);
            console.log(`Message: ${data.message}`);
            console.log(`Progress: ${data.progress}%`);
            
            // Check content
            if (data.content_feed && data.content_feed.length > 0) {
                console.log('Triggered Content:');
                data.content_feed.forEach(c => {
                    console.log(`  - [${c.content_type}] ${c.title}: ${c.description}`);
                });
            } else {
                console.log('No content triggered.');
            }
            
        } catch (e) {
            console.error(`❌ Failed to track order:`, e.message);
        }
        
        // Small delay for visual effect in logs
        await new Promise(r => setTimeout(r, 500));
    }
    
    // 3. Test Urgency Monitor
    console.log('\n--- Testing Urgency Monitor (FOMO) ---');
    // Set expiration to 1 hour from now (should trigger urgency)
    await db.run(`
        UPDATE shop_orders 
        SET status = 'pending', reservation_expires_at = datetime('now', '+1 hour'), urgency_level = 'normal'
        WHERE id = ?
    `, [orderId]);
    
    try {
        const monitorRes = await axios.get(`${API_URL}/run-monitor`);
        console.log(`Monitor Run Result: Updated ${monitorRes.data.updated_count} orders.`);
        
        const trackRes = await axios.get(`${API_URL}/track/${orderId}`);
        console.log(`New Urgency Level: ${trackRes.data.urgency_level}`);
        
        if (trackRes.data.urgency_level === 'high') {
            console.log('✅ Urgency successfully escalated!');
        } else {
            console.log('❌ Urgency NOT escalated.');
        }
    } catch (e) {
        console.error('❌ Failed to run monitor:', e.message);
    }

    // Cleanup
    // await db.run("DELETE FROM shop_orders WHERE id = ?", [orderId]);
    await db.close();
    console.log('\n✨ Verification Complete!');
}

main().catch(console.error);
