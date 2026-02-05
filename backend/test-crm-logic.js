
const { DatabaseManager } = require('./src/js/mysql-config');
const { CRMApi } = require('./scripts/crm-api.js');

async function testCRMScenarios() {
    const db = new DatabaseManager();
    await db.initialize();
    const crm = new CRMApi(null, null, db);

    console.log('--- 🧪 STARTING CRM SCENARIOS TEST ---');

    try {
        // Сценарий 1: Создание заявки (Quick Order)
        console.log('\n🔹 Scenario 1: Quick Order');
        const leadData = {
            source: 'test_script',
            customer_name: 'Test Customer',
            contact_method: 'telegram',
            contact_value: '@testuser',
            bike_url: 'https://example.com/bike123',
            notes: 'I want this bike fast!'
        };
        const lead = await crm.createApplication(leadData);
        console.log('✅ Lead created:', lead.id);

        // Сценарий 2: Конвертация в заказ
        console.log('\n🔹 Scenario 2: Create Order from Lead');
        const order = await crm.createOrder({
            lead_id: lead.id,
            customer_id: lead.customer_id,
            bike_url: lead.bike_url,
            final_price_eur: 2500,
            commission_eur: 200
        });
        console.log('✅ Order created:', order.order_code, 'ID:', order.id);

        // Сценарий 3: Входящий платеж от клиента
        console.log('\n🔹 Scenario 3: Incoming Client Payment');
        const payment = await crm.createFinanceRecord({
            order_id: order.id,
            direction: 'incoming',
            role: 'client_payment',
            method: 'bank_transfer',
            amount: 2500,
            currency: 'EUR',
            external_reference: 'TXN-12345'
        });
        console.log('✅ Payment registered:', payment.id);

        // Сценарий 4: Проверка смены статуса заказа
        const updatedOrder = await crm._request({
            table: 'orders',
            method: 'GET',
            filters: { id: `eq.${order.id}` }
        });
        console.log('📊 Order status after payment:', updatedOrder[0].status);

        // Сценарий 5: Исходящий платеж поставщику
        console.log('\n🔹 Scenario 5: Outgoing Supplier Payment');
        const supplierPayment = await crm.createFinanceRecord({
            order_id: order.id,
            direction: 'outgoing',
            role: 'supplier_payment',
            method: 'crypto',
            amount: 2100,
            currency: 'EUR'
        });
        console.log('✅ Supplier payment registered:', supplierPayment.id);

        // Сценарий 6: Прикрепление документа
        console.log('\n🔹 Scenario 6: Attach Document');
        await crm._request({
            table: 'documents',
            method: 'POST',
            body: {
                id: crm.generateUUID(),
                order_id: order.id,
                type: 'invoice',
                file_url: 'https://storage.eubike.com/invoices/inv-001.pdf'
            }
        });
        console.log('✅ Document attached');

        // Сценарий 7: Создание задачи
        console.log('\n🔹 Scenario 7: Create Task');
        await crm._request({
            table: 'tasks',
            method: 'POST',
            body: {
                id: crm.generateUUID(),
                order_id: order.id,
                title: 'Check bike at warehouse',
                description: 'Verify if there are any scratches',
                due_at: new Date(Date.now() + 86400000).toISOString()
            }
        });
        console.log('✅ Task created');

        // Сценарий 8: Быстрый заказ (Quick Order API)
        console.log('\n🔹 Scenario 8: Quick Order Method');
        const quickOrder = await crm.createQuickOrder({
            name: 'Quick Customer',
            contact_method: 'telegram',
            contact_value: '@quickuser',
            notes: 'I want this bike now!'
        });
        console.log('✅ Quick order created:', quickOrder.order_code);

        // Сценарий 9: Получение заказов пользователя
        console.log('\n🔹 Scenario 9: Get User Orders');
        const userOrders = await crm.getUserOrders('@quickuser');
        console.log('✅ Found orders for user:', userOrders.length);

        console.log('\n--- 🏁 ALL SCENARIOS COMPLETED SUCCESSFULLY ---');

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        console.error(error);
    } finally {
        await db.close();
    }
}

testCRMScenarios();
