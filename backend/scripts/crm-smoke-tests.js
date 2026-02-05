const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8082/api';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_API_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

async function login(email, password) {
    if (!email || !password) {
        return null;
    }
    try {
        const res = await axios.post(`${API_BASE}/auth/login`, { email, password }, { validateStatus: () => true });
        if (!res.data || res.status !== 200 || !res.data.token) {
            return null;
        }
        return res.data.token;
    } catch {
        return null;
    }
}

async function callBackend(method, url, token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return axios.request({
        method,
        url: `${API_BASE}${url}`,
        data: body || undefined,
        headers,
        validateStatus: () => true
    });
}

async function callSupabaseRpc(fn, payload) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return null;
    }
    try {
        const res = await axios.post(
            `${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(fn)}`,
            payload,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true
            }
        );
        return res;
    } catch (e) {
        return { error: e };
    }
}

async function testResolveUser() {
    const email = process.env.SMOKE_USER_EMAIL;
    const password = process.env.SMOKE_USER_PASSWORD;
    console.log('=== resolve-user: success and error ===');
    const token = await login(email, password);
    if (token) {
        const okRes = await callBackend('post', '/v1/crm/resolve-user', token, {});
        console.log('resolve-user (auth) status:', okRes.status);
        console.log('resolve-user (auth) body:', okRes.data);
    } else {
        console.log('resolve-user (auth) skipped: SMOKE_USER_EMAIL/SMOKE_USER_PASSWORD not usable');
    }
    const noAuthRes = await callBackend('post', '/v1/crm/resolve-user', null, {});
    console.log('resolve-user (no auth) status:', noAuthRes.status);
    console.log('resolve-user (no auth) body:', noAuthRes.data);
}

async function testOrderStatusWithoutUser() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('advance_order_status_safe skipped: SUPABASE_URL/SUPABASE_KEY not configured');
        return;
    }
    const orderId = process.env.SMOKE_ORDER_ID || '';
    if (!orderId) {
        console.log('advance_order_status_safe skipped: SMOKE_ORDER_ID not set');
        return;
    }
    console.log('=== advance_order_status_safe with null user ===');
    const res = await callSupabaseRpc('advance_order_status_safe', {
        p_order_id: orderId,
        p_new_status: 'closed',
        p_user_id: null,
        p_reason: null,
        p_notes: null
    });
    if (!res) {
        console.log('advance_order_status_safe: no response (config issue)');
        return;
    }
    console.log('status:', res.status);
    console.log('body:', res.data || res.error);
}

async function testRefundFromManager() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('record_generic_payment_safe refund skipped: SUPABASE_URL/SUPABASE_KEY not configured');
        return;
    }
    const orderId = process.env.SMOKE_REFUND_ORDER_ID || '';
    const managerId = process.env.SMOKE_MANAGER_USER_ID || '';
    if (!orderId || !managerId) {
        console.log('record_generic_payment_safe refund skipped: SMOKE_REFUND_ORDER_ID/SMOKE_MANAGER_USER_ID not set');
        return;
    }
    console.log('=== record_generic_payment_safe refund by manager ===');
    const res = await callSupabaseRpc('record_generic_payment_safe', {
        p_order_id: orderId,
        p_direction: 'outgoing',
        p_role: 'refund',
        p_method: 'online_cashbox',
        p_amount: 1000,
        p_currency: 'EUR',
        p_status: 'completed',
        p_external_reference: null,
        p_related_payment_id: null,
        p_user_id: managerId
    });
    if (!res) {
        console.log('record_generic_payment_safe refund: no response (config issue)');
        return;
    }
    console.log('status:', res.status);
    console.log('body:', res.data || res.error);
}

async function testOutgoingWithoutClientPayment() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('record_generic_payment_safe outgoing skipped: SUPABASE_URL/SUPABASE_KEY not configured');
        return;
    }
    const orderId = process.env.SMOKE_OUTGOING_ORDER_ID || '';
    const userId = process.env.SMOKE_ADMIN_USER_ID || process.env.SMOKE_MANAGER_USER_ID || '';
    if (!orderId || !userId) {
        console.log('record_generic_payment_safe outgoing skipped: SMOKE_OUTGOING_ORDER_ID/SMOKE_ADMIN_USER_ID not set');
        return;
    }
    console.log('=== record_generic_payment_safe outgoing without client payment ===');
    const res = await callSupabaseRpc('record_generic_payment_safe', {
        p_order_id: orderId,
        p_direction: 'outgoing',
        p_role: 'supplier_payment',
        p_method: 'online_cashbox',
        p_amount: 1000,
        p_currency: 'EUR',
        p_status: 'completed',
        p_external_reference: null,
        p_related_payment_id: null,
        p_user_id: userId
    });
    if (!res) {
        console.log('record_generic_payment_safe outgoing: no response (config issue)');
        return;
    }
    console.log('status:', res.status);
    console.log('body:', res.data || res.error);
}

async function testDirectOrderStatusUpdate() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('direct orders.status PATCH skipped: SUPABASE_URL/SUPABASE_KEY not configured');
        return;
    }
    const orderId = process.env.SMOKE_DIRECT_UPDATE_ORDER_ID || '';
    if (!orderId) {
        console.log('direct orders.status PATCH skipped: SMOKE_DIRECT_UPDATE_ORDER_ID not set');
        return;
    }
    console.log('=== direct PATCH orders.status via REST ===');
    try {
        const res = await axios.patch(
            `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
            { status: 'closed' },
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true
            }
        );
        console.log('status:', res.status);
        console.log('body:', res.data);
    } catch (e) {
        console.log('direct orders.status PATCH error:', e && e.message ? e.message : e);
    }
}

async function testLegacyTablesWriteBlocked() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('legacy tables write blocked skipped: SUPABASE_URL/SUPABASE_KEY not configured');
        return;
    }
    console.log('=== legacy tables write blocked via REST ===');
    const tableNames = [
        'Заказы | FRM',
        'Заявки | CRM',
        'Финансы | FM',
        'Логистика | LM',
        'Сотрудники | ET',
        'История заказов | OH',
        'История заявок | AH'
    ];
    for (const t of tableNames) {
        const encoded = encodeURIComponent(t);
        try {
            const res = await axios.post(
                `${SUPABASE_URL}/rest/v1/${encoded}`,
                { test_column: 'x' },
                {
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    },
                    validateStatus: () => true
                }
            );
            console.log(`[${t}] write status:`, res.status);
            console.log(`[${t}] write body:`, res.data);
        } catch (e) {
            console.log(`[${t}] write error:`, e && e.message ? e.message : e);
        }
    }
}

async function main() {
    await testResolveUser();
    await testOrderStatusWithoutUser();
    await testRefundFromManager();
    await testOutgoingWithoutClientPayment();
    await testDirectOrderStatusUpdate();
    await testLegacyTablesWriteBlocked();
}

main().catch((e) => {
    console.error('Smoke tests failed:', e);
    process.exit(1);
});
