const axios = require('axios');

const API_BASE = 'http://localhost:8082/api';

async function testQuickOrder() {
    console.log('=== Testing /api/v1/crm/orders/quick ===');
    try {
        const payload = {
            name: 'Test Quick Order User',
            contact_method: 'phone',
            contact_value: '+79991234567',
            notes: 'This is a test quick order'
        };
        const res = await axios.post(`${API_BASE}/v1/crm/orders/quick`, payload, {
            validateStatus: () => true
        });
        console.log('Status:', res.status);
        console.log('Body:', JSON.stringify(res.data, null, 2));
        if (res.status === 200 && res.data.success) {
            console.log('✅ Quick order test passed');
        } else {
            console.log('❌ Quick order test failed');
        }
    } catch (error) {
        console.error('Error testing quick order:', error.message);
    }
}

async function testCreateLead() {
    console.log('\n=== Testing /api/v1/crm/leads ===');
    try {
        const payload = {
            name: 'Test Lead User',
            contact_method: 'email',
            contact_value: 'test@example.com',
            bike_interest: 'Specialized Turbo Levo',
            notes: 'Interested in financing options'
        };
        const res = await axios.post(`${API_BASE}/v1/crm/leads`, payload, {
            validateStatus: () => true
        });
        console.log('Status:', res.status);
        console.log('Body:', JSON.stringify(res.data, null, 2));
        if (res.status === 200 && res.data.success) {
            console.log('✅ Create lead test passed');
        } else {
            console.log('❌ Create lead test failed');
        }
    } catch (error) {
        console.error('Error testing create lead:', error.message);
    }
}

async function testCreateApplication() {
    console.log('\n=== Testing /api/v1/crm/applications ===');
    try {
        const payload = {
            name: 'Test Application User',
            contact_method: 'telegram',
            contact_value: '@testuser',
            notes: 'Test application notes',
            bike_url: 'https://example.com/bike',
            budget: 5000
        };
        const res = await axios.post(`${API_BASE}/v1/crm/applications`, payload, {
            validateStatus: () => true
        });
        console.log('Status:', res.status);
        console.log('Body:', JSON.stringify(res.data, null, 2));
        if (res.status === 200 && res.data.success) {
            console.log('✅ Create application test passed');
        } else {
            console.log('❌ Create application test failed');
        }
    } catch (error) {
        console.error('Error testing create application:', error.message);
    }
}

async function runTests() {
    await testQuickOrder();
    await testCreateLead();
    await testCreateApplication();
}

runTests();
