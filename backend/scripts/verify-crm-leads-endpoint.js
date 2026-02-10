const axios = require('axios');

const API_ROOT = process.env.CRM_API_BASE || 'http://localhost:8082/api';
const LOGIN_EMAIL = process.env.CRM_TEST_EMAIL || 'crm.manager@local';
const LOGIN_PASSWORD = process.env.CRM_TEST_PASSWORD || 'crmtest123';
const ALLOW_WRITE = String(process.env.ALLOW_WRITE || 'false') === 'true';

function randomUuidLike() {
    return '00000000-0000-4000-8000-000000000000'.replace(/0/g, () => Math.floor(Math.random() * 16).toString(16));
}

async function login() {
    const response = await axios.post(`${API_ROOT}/auth/login`, {
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD
    }, { validateStatus: () => true });
    if (response.status !== 200 || !response.data?.token) {
        throw new Error(`Login failed: HTTP ${response.status}`);
    }
    return response.data.token;
}

async function callLeadUpdate(token, leadId, payload, extraHeaders = {}) {
    return axios.patch(`${API_ROOT}/v1/crm/leads/${encodeURIComponent(leadId)}`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
            ...extraHeaders
        },
        validateStatus: () => true
    });
}

async function loadFirstLead(token) {
    const response = await axios.get(`${API_ROOT}/v1/crm/leads?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true
    });
    if (response.status !== 200) return null;
    const leads = Array.isArray(response.data?.leads) ? response.data.leads : [];
    return leads[0] || null;
}

async function main() {
    const token = await login();
    const checks = [];

    // 400: invalid id format
    const invalid = await callLeadUpdate(token, 'bad id!', { status: 'new' });
    checks.push({ name: 'invalid id -> 400', ok: invalid.status === 400, status: invalid.status });

    // 503: simulated Supabase outage (dev-only guard)
    const simulated503 = await callLeadUpdate(token, randomUuidLike(), { status: 'new' }, { 'x-simulate-supabase-down': '1' });
    checks.push({ name: 'simulated outage -> 503', ok: simulated503.status === 503, status: simulated503.status });

    // 404: valid id format but nonexistent lead
    const missing = await callLeadUpdate(token, randomUuidLike(), { status: 'new' });
    checks.push({ name: 'missing lead -> 404', ok: missing.status === 404, status: missing.status });

    // 200: optional (writes lead row, so disabled by default)
    if (ALLOW_WRITE) {
        const lead = await loadFirstLead(token);
        if (lead?.id) {
            const status = String(lead.status || 'new');
            const okResponse = await callLeadUpdate(token, lead.id, { status });
            checks.push({ name: 'existing lead -> 200', ok: okResponse.status === 200, status: okResponse.status });
        } else {
            checks.push({ name: 'existing lead -> 200', ok: false, status: 'skipped (no leads found)' });
        }
    } else {
        checks.push({ name: 'existing lead -> 200', ok: true, status: 'skipped (set ALLOW_WRITE=true to run)' });
    }

    const failed = checks.filter((item) => !item.ok);
    checks.forEach((item) => {
        const marker = item.ok ? 'PASS' : 'FAIL';
        console.log(`${marker}: ${item.name} (${item.status})`);
    });

    if (failed.length) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error('verify-crm-leads-endpoint failed:', error.message);
    process.exit(1);
});
