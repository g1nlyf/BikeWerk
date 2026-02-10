const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const PORT = process.env.CRM_TEST_PORT || 8090;
const BASE_URL = `http://localhost:${PORT}/api`;
const DB_PATH = path.join(__dirname, '..', 'database', 'eubike.db');

const MANAGER_EMAIL = process.env.CRM_TEST_MANAGER_EMAIL || 'crm.manager@local';
const MANAGER_PASSWORD = process.env.CRM_TEST_MANAGER_PASSWORD || 'crmtest123';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await axios.get(`${BASE_URL}/health`, { validateStatus: () => true });
            if (res.status === 200) return true;
        } catch { }
        await sleep(500);
    }
    throw new Error('Server did not become healthy in time');
}

function ensureManagerUser() {
    const db = new Database(DB_PATH);
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    const has = (name) => cols.includes(name);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(MANAGER_EMAIL);
    const hashed = bcrypt.hashSync(MANAGER_PASSWORD, 10);

    if (existing) {
        const updates = ['password = ?', 'role = ?'];
        const params = [hashed, 'manager'];
        if (has('updated_at')) {
            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
        }
        params.push(existing.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        db.close();
        return existing.id;
    }

    const payload = {
        name: 'CRM Manager',
        email: MANAGER_EMAIL,
        password: hashed,
        role: 'manager',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    if (has('must_change_password')) payload.must_change_password = 0;
    if (has('must_set_email')) payload.must_set_email = 0;

    const keys = Object.keys(payload).filter(k => has(k));
    const sql = `INSERT INTO users (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    const params = keys.map(k => payload[k]);
    const result = db.prepare(sql).run(...params);
    db.close();
    return result.lastInsertRowid;
}

function ensureTestOrder() {
    const db = new Database(DB_PATH);
    const customerId = `CUST-TEST-${Date.now()}`;
    const orderId = `ORD-TEST-${Date.now()}`;
    const orderCode = orderId;

    db.prepare('INSERT INTO customers (id, full_name, email, phone, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
        .run(customerId, 'Test Customer', 'test.customer@local', '+79990001122');

    const snapshot = {
        basic_info: { brand: 'Test', model: 'Bike', name: 'Test Bike' },
        pricing: { final_price_eur: 1234 }
    };

    db.prepare(`INSERT INTO orders (id, order_code, customer_id, status, final_price_eur, bike_snapshot, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
        .run(orderId, orderCode, customerId, 'pending_manager', 1234, JSON.stringify(snapshot));

    db.close();
    return { orderId, orderCode };
}

async function login() {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email: MANAGER_EMAIL, password: MANAGER_PASSWORD }, { validateStatus: () => true });
    if (res.status !== 200 || !res.data?.token) {
        throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.data)}`);
    }
    return res.data.token;
}

async function call(method, url, token, body) {
    return axios.request({
        method,
        url: `${BASE_URL}${url}`,
        data: body || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        validateStatus: () => true
    });
}

async function run() {
    const server = spawn('node', ['backend/server.js'], {
        cwd: path.join(__dirname, '..', '..'),
        env: { ...process.env, PORT: String(PORT) },
        stdio: 'inherit'
    });

    try {
        await waitForHealth();
        const managerId = ensureManagerUser();
        const { orderId } = ensureTestOrder();
        const token = await login();

        const unauth = await call('get', '/v1/crm/orders', null);
        if (![401, 403].includes(unauth.status)) {
            throw new Error(`Expected unauthorized, got ${unauth.status}`);
        }

        const stats = await call('get', '/v1/crm/dashboard/stats', token);
        if (stats.status !== 200 || !stats.data?.stats) {
            throw new Error(`Stats failed: ${stats.status} ${JSON.stringify(stats.data)}`);
        }

        const list = await call('get', '/v1/crm/orders?status=pending_manager&limit=10', token);
        if (list.status !== 200 || !Array.isArray(list.data?.orders)) {
            throw new Error(`Orders list failed: ${list.status} ${JSON.stringify(list.data)}`);
        }

        const assign = await call('patch', `/v1/crm/orders/${encodeURIComponent(orderId)}/manager`, token, { manager_id: String(managerId) });
        if (assign.status !== 200 || !assign.data?.order) {
            throw new Error(`Assign manager failed: ${assign.status} ${JSON.stringify(assign.data)}`);
        }

        const update = await call('patch', `/v1/crm/orders/${encodeURIComponent(orderId)}/status`, token, { status: 'under_inspection', note: 'Sprint1 test' });
        if (update.status !== 200 || update.data?.order?.status !== 'under_inspection') {
            throw new Error(`Update status failed: ${update.status} ${JSON.stringify(update.data)}`);
        }

        console.log('✅ CRM Sprint 1 tests completed successfully');
    } finally {
        server.kill('SIGINT');
    }
}

run().catch((err) => {
    console.error('❌ CRM Sprint 1 tests failed:', err.message || err);
    process.exit(1);
});
