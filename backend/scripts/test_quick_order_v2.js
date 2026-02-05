const axios = require('axios');

async function testQuickOrder() {
    const payload = {
        name: "Test User V2",
        contact_method: "email",
        contact_value: "testv2@example.com",
        notes: "Testing detailed payload",
        items: [
            {
                bike_id: "101",
                quantity: 1,
                price: 2500,
                specifications: {
                    Frame: "Carbon",
                    Groupset: "SRAM Red"
                },
                size: "56",
                color: "Matte Black",
                condition: "new",
                year: 2024,
                brand: "Canyon",
                model: "Ultimate",
                category: "Road",
                original_price: 2500
            }
        ]
    };

    try {
        console.log('Sending payload:', JSON.stringify(payload, null, 2));
        const response = await axios.post('http://localhost:8082/api/v1/crm/orders/quick', payload);
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error details:', error);
    }
}

testQuickOrder();
