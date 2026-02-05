const axios = require('axios');

async function verify() {
    try {
        const res = await axios.get('http://localhost:8082/api/bikes?hot=true&limit=5');
        console.log('API Status:', res.status);
        console.log('Bikes found:', res.data.bikes.length);
        if (res.data.bikes.length > 0) {
            console.log('First bike:', {
                id: res.data.bikes[0].id,
                brand: res.data.bikes[0].brand,
                is_hot_offer: res.data.bikes[0].is_hot_offer,
                ranking_score: res.data.bikes[0].ranking_score,
                is_hot: res.data.bikes[0].is_hot // The computed field
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Response:', e.response.data);
    }
}

verify();
