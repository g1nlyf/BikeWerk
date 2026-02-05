
const http = require('http');

// Helper to make requests
function makeRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8082,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : {} });
                } catch (e) {
                    console.log('Raw body:', data);
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function testFlow() {
    const email = `test${Date.now()}@example.com`;
    const password = 'password123';

    console.log('1. Registering user...', email);
    const regRes = await makeRequest('POST', '/api/auth/register', {
        email,
        password,
        name: 'Test User'
    });
    console.log('Register status:', regRes.statusCode);

    console.log('2. Logging in...');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
        email,
        password
    });
    console.log('Login status:', loginRes.statusCode);
    
    const token = loginRes.body.token;
    if (!token) {
        console.error('No token received');
        return;
    }

    console.log('3. Adding item to cart...');
    // First get a bike ID
    const bikesRes = await makeRequest('GET', '/api/bikes?limit=1');
    const bikeId = bikesRes.body.bikes[0].id;
    console.log('Using bike ID:', bikeId);

    const addCartRes = await makeRequest('POST', '/api/cart', {
        bikeId: bikeId,
        quantity: 1
    }, token);
    console.log('Add to cart status:', addCartRes.statusCode);

    console.log('4. Fetching cart (Testing the 500 fix)...');
    const cartRes = await makeRequest('GET', '/api/cart', null, token);
    console.log('Get cart status:', cartRes.statusCode);
    
    if (cartRes.statusCode === 200) {
        console.log('SUCCESS! Cart data received:');
        console.log(JSON.stringify(cartRes.body, null, 2));
    } else {
        console.log('FAILED! Response:', cartRes.body);
    }
}

testFlow().catch(console.error);
