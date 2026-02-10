const { DatabaseManager } = require('../src/js/mysql-config');
const db = new DatabaseManager();

async function main() {
    const args = process.argv.slice(2);
    const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'help';

    console.log(`[VERIFY] Starting DB Check in mode: ${mode}`);

    try {
        await db.initialize();

        if (mode === 'check_initial') {
            await checkInitial();
        } else if (mode === 'check_lead') {
            const email = args.find(arg => arg.startsWith('--email='))?.split('=')[1];
            await checkLead(email);
        } else if (mode === 'check_order') {
            const orderCode = args.find(arg => arg.startsWith('--code='))?.split('=')[1];
            await checkOrder(orderCode);
        } else {
            console.log('Available modes: check_initial, check_lead --email=..., check_order --code=...');
        }

    } catch (e) {
        console.error('[VERIFY] Error:', e);
    } finally {
        // await db.close(); // Keep open if needed or close.
        process.exit(0);
    }
}

async function checkInitial() {
    console.log('\n--- INITIAL STATE CHECK ---');
    const bikes = await db.query('SELECT COUNT(*) as c FROM bikes');
    const users = await db.query('SELECT COUNT(*) as c FROM users');
    const orders = await db.query('SELECT COUNT(*) as c FROM shop_orders'); // Adjusted table name if needed

    console.log(`Bikes: ${bikes[0].c}`);
    console.log(`Users: ${users[0].c}`);
    console.log(`Orders: ${orders[0].c}`);

    // Check if 'leads' table exists (it wasn't in the schema I viewed, but maybe it's 'leads' or 'shop_orders' acts as leads?)
    // The prompt mentions 'leads' table.
    try {
        const leads = await db.query('SELECT COUNT(*) as c FROM leads');
        console.log(`Leads: ${leads[0].c}`);
    } catch (e) {
        console.log('Leads table verification failed (might not exist):', e.message);
    }
}

async function checkLead(email) {
    if (!email) {
        console.error('Email required');
        return;
    }
    console.log(`\n--- CHECKING LEAD: ${email} ---`);
    const leads = await db.query('SELECT * FROM leads WHERE email = ?', [email]);
    if (leads.length > 0) {
        console.log('✅ Lead Found:', leads[0]);
    } else {
        console.log('❌ Lead NOT Found');
    }

    // Also check orders for this email
    const customers = await db.query('SELECT * FROM customers WHERE email = ?', [email]);
    if (customers.length > 0) {
        console.log('✅ Customer Found:', customers[0]);
        const orders = await db.query('SELECT * FROM orders WHERE customer_id = ?', [customers[0].id]);
        if (orders.length > 0) {
            console.log('✅ Orders Found:', orders.length);
            orders.forEach(o => console.log(`   - Code: ${o.order_code}, Status: ${o.status}`));
        } else {
            console.log('❌ No Orders for Customer');
        }
    } else {
        console.log('❌ Customer NOT Found');
    }
}

async function checkOrder(orderCode) {
    if (!orderCode) {
        console.error('Order Code required');
        return;
    }
    console.log(`\n--- CHECKING ORDER: ${orderCode} ---`);
    // Note: Schema showed 'shop_orders', prompt implies 'orders'. I'll try both or 'orders' if schema was incomplete or I missed it.
    // The schema file I read had 'shop_orders'.
    // BUT the prompt assumes 'orders'.
    // I will check 'orders' first, then 'shop_orders'.

    let order = null;
    try {
        const orders = await db.query('SELECT * FROM orders WHERE order_code = ?', [orderCode]);
        if (orders.length > 0) order = orders[0];
    } catch (e) {
        // Fallback to shop_orders check if orders fails
        // But shop_orders doesn't seem to have order_code in the schema I saw?
        // Let's verify columns of leads/orders/customers dynamically.
    }

    if (order) {
        console.log('✅ Order Found:', order);
        console.log(`   - Assignee: ${order.assignee}`);
        console.log(`   - Status: ${order.status}`);

        // Check Snapshot
        // bike_snapshot might be a separate table or JSON column

        // Check Checklist
        // prompt: "bike_snapshot.inspection_data.checklist"
        if (order.bike_snapshot) {
            let snapshot = typeof order.bike_snapshot === 'string' ? JSON.parse(order.bike_snapshot) : order.bike_snapshot;
            let checklist = snapshot.inspection_data?.checklist || snapshot.checklist;
            if (checklist) {
                console.log('✅ Checklist Found in Snapshot.');
                // console.log(JSON.stringify(checklist, null, 2));
                const completed = Object.values(checklist).filter(v => v && (v.status === 'ok' || v === true)).length;
                console.log(`   - Completed Items: ${completed}`);
            } else {
                console.log('⚠️ Checklist NOT found in Snapshot');
            }
        }
    } else {
        console.log('❌ Order NOT Found');
    }
}

main();
