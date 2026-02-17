/* eslint-disable no-console */
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const API_ROOT = process.env.ADMIN_TEST_BASE_URL || 'http://localhost:8082/api';
const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL || 'admin@eubike.com';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD || 'admin123';

const REPORT_PATH = path.resolve(__dirname, '../test-outputs/admin-panel-endpoints-latest.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(pathname, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    expectText = false,
    timeoutMs = 30000
  } = options;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_ROOT}${pathname}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });

    if (expectText) {
      const text = await res.text();
      return { ok: res.ok, status: res.status, data: text };
    }

    let data;
    try {
      data = await res.json();
    } catch {
      data = { parse_error: true };
    }

    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function isServerHealthy() {
  try {
    const res = await fetch(`${API_ROOT}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServerUp() {
  if (await isServerHealthy()) return { spawned: null };

  const backendRoot = path.resolve(__dirname, '..');
  const child = spawn('node', ['server.js'], {
    cwd: backendRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await isServerHealthy()) {
      return { spawned: child };
    }
    await sleep(1200);
  }

  child.kill('SIGTERM');
  throw new Error('Server did not start within 90s');
}

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  if (process.env.ADMIN_SECRET) {
    headers['x-admin-secret'] = process.env.ADMIN_SECRET;
    return headers;
  }

  const login = await request('/auth/login', {
    method: 'POST',
    headers,
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  const token = login?.data?.token;
  if (!token) {
    throw new Error(`Admin login failed: ${JSON.stringify(login.data)}`);
  }

  headers.Authorization = `Bearer ${token}`;
  return headers;
}

function makeRecorder() {
  const cases = [];

  function add(name, passed, meta = {}) {
    cases.push({ name, passed, ...meta });
    const tag = passed ? 'PASS' : 'FAIL';
    const suffix = meta.message ? ` - ${meta.message}` : '';
    console.log(`[${tag}] ${name}${suffix}`);
  }

  function summary() {
    const total = cases.length;
    const failed = cases.filter((c) => !c.passed);
    return { total, failed: failed.length, cases, failedCases: failed };
  }

  return { add, summary };
}

async function run() {
  const startTs = new Date().toISOString();
  const { add, summary } = makeRecorder();

  const server = await ensureServerUp();
  let headers;

  try {
    headers = await getAuthHeaders();

    const basicGetEndpoints = [
      '/admin/stats',
      '/admin/stats/business',
      '/admin/finance/summary',
      '/admin/stats/daily',
      '/admin/finance/overview?window=30d',
      '/admin/orders?window=30d&limit=20',
      '/admin/alerts',
      '/admin/system/status',
      '/admin/logs?limit=20',
      '/admin/analytics/market',
      '/admin/hunter/stats?range=7d',
      '/admin/hunter/logs',
      '/admin/audit/pending',
      '/admin/scoring/config',
      '/admin/tests/logs'
    ];

    for (const endpoint of basicGetEndpoints) {
      const res = await request(endpoint, { headers });
      const hasError = !res.ok || (res.data && res.data.success === false);
      add(`GET ${endpoint}`, !hasError, {
        status: res.status,
        message: hasError ? JSON.stringify(res.data).slice(0, 200) : 'ok'
      });
    }

    const csv = await request('/admin/export/orders.csv?window=7d', { headers, expectText: true });
    const csvText = String(csv.data || '');
    const csvOk = csv.ok && csvText.includes(',') && csvText.includes('\n');
    add('GET /admin/export/orders.csv', csvOk, {
      status: csv.status,
      message: csvOk ? 'csv ok' : 'invalid csv payload'
    });

    const bikesRes = await request('/admin/bikes?limit=10', { headers });
    const bikes = Array.isArray(bikesRes.data?.bikes) ? bikesRes.data.bikes : [];
    add('GET /admin/bikes?limit=10', bikesRes.ok && bikes.length > 0, {
      status: bikesRes.status,
      message: bikes.length ? `loaded ${bikes.length}` : 'no bikes in catalog'
    });

    const bike = bikes[0] || null;
    if (!bike) {
      throw new Error('No bikes available to continue dynamic endpoint tests');
    }

    const bikeId = Number(bike.id);

    const bikeDetail = await request(`/bikes/${bikeId}`, { headers });
    add(`GET /bikes/${bikeId}`, bikeDetail.ok, {
      status: bikeDetail.status,
      message: bikeDetail.ok ? 'ok' : JSON.stringify(bikeDetail.data).slice(0, 200)
    });

    const evalGet = await request(`/admin/bikes/${bikeId}/evaluation`, { headers });
    add(`GET /admin/bikes/${bikeId}/evaluation`, evalGet.ok, {
      status: evalGet.status,
      message: evalGet.ok ? 'ok' : JSON.stringify(evalGet.data).slice(0, 200)
    });

    const evalSave = await request(`/admin/bikes/${bikeId}/evaluation`, {
      method: 'POST',
      headers,
      body: {
        price_value_score: 7,
        quality_appearance_score: 7,
        detail_intent_score: 7,
        trust_confidence_score: 7,
        seasonal_fit_score: 7,
        notes: 'admin-panel-smoke-test'
      }
    });
    add(`POST /admin/bikes/${bikeId}/evaluation`, evalSave.ok && evalSave.data?.success !== false, {
      status: evalSave.status,
      message: evalSave.ok ? 'ok' : JSON.stringify(evalSave.data).slice(0, 200)
    });

    const recomputeOne = await request(`/admin/bikes/${bikeId}/recompute`, {
      method: 'POST',
      headers,
      body: {}
    });
    add(`POST /admin/bikes/${bikeId}/recompute`, recomputeOne.ok, {
      status: recomputeOne.status,
      message: recomputeOne.ok ? 'ok' : JSON.stringify(recomputeOne.data).slice(0, 200)
    });

    const toggleHotOn = await request(`/admin/bikes/${bikeId}/toggle-hot`, {
      method: 'POST',
      headers,
      body: { is_hot: true }
    });
    add(`POST /admin/bikes/${bikeId}/toggle-hot (on)`, toggleHotOn.ok, {
      status: toggleHotOn.status,
      message: toggleHotOn.ok ? 'ok' : JSON.stringify(toggleHotOn.data).slice(0, 200)
    });

    const toggleHotOff = await request(`/admin/bikes/${bikeId}/toggle-hot`, {
      method: 'POST',
      headers,
      body: { is_hot: false }
    });
    add(`POST /admin/bikes/${bikeId}/toggle-hot (off)`, toggleHotOff.ok, {
      status: toggleHotOff.status,
      message: toggleHotOff.ok ? 'ok' : JSON.stringify(toggleHotOff.data).slice(0, 200)
    });

    const bikeName = String(bike.name || `${bike.brand || ''} ${bike.model || ''}`.trim() || `Bike ${bikeId}`);
    const putBike = await request(`/admin/bikes/${bikeId}`, {
      method: 'PUT',
      headers,
      body: {
        name: bikeName,
        brand: bike.brand || '',
        model: bike.model || '',
        price: Number(bike.price || 0),
        category: bike.category || 'other',
        is_active: 1
      }
    });
    add(`PUT /admin/bikes/${bikeId}`, putBike.ok, {
      status: putBike.status,
      message: putBike.ok ? 'ok' : JSON.stringify(putBike.data).slice(0, 200)
    });

    const deactivate = await request(`/admin/bikes/${bikeId}/deactivate`, { headers });
    add(`GET /admin/bikes/${bikeId}/deactivate`, deactivate.ok, {
      status: deactivate.status,
      message: deactivate.ok ? 'ok' : JSON.stringify(deactivate.data).slice(0, 200)
    });

    const reactivate = await request(`/admin/bikes/${bikeId}`, {
      method: 'PUT',
      headers,
      body: { is_active: 1 }
    });
    add(`PUT /admin/bikes/${bikeId} (reactivate)`, reactivate.ok, {
      status: reactivate.status,
      message: reactivate.ok ? 'ok' : JSON.stringify(reactivate.data).slice(0, 200)
    });

    const negotiation = await request('/admin/generate-negotiation', {
      method: 'POST',
      headers,
      body: { bikeId, context: 'initial' }
    });
    add('POST /admin/generate-negotiation', negotiation.ok && typeof negotiation.data?.message === 'string', {
      status: negotiation.status,
      message: negotiation.ok ? 'ok' : JSON.stringify(negotiation.data).slice(0, 200)
    });

    const auditResolve = await request('/admin/audit/0/resolve', {
      method: 'POST',
      headers,
      body: { verdict: 'agree' }
    });
    add('POST /admin/audit/0/resolve', auditResolve.ok, {
      status: auditResolve.status,
      message: auditResolve.ok ? 'ok' : JSON.stringify(auditResolve.data).slice(0, 200)
    });

    const huntApi = await request('/admin/hunt', {
      method: 'POST',
      headers,
      body: { priority: 'smart' }
    });
    add('POST /admin/hunt', huntApi.ok, {
      status: huntApi.status,
      message: huntApi.ok ? 'ok' : JSON.stringify(huntApi.data).slice(0, 200)
    });

    const huntTrigger = await request('/admin/labs/hunt-trigger', {
      method: 'POST',
      headers,
      body: { count: 1 }
    });
    add('POST /admin/labs/hunt-trigger', huntTrigger.ok, {
      status: huntTrigger.status,
      message: huntTrigger.ok ? 'ok' : JSON.stringify(huntTrigger.data).slice(0, 200)
    });

    const recomputeAll = await request('/admin/ranking/recompute-all', {
      method: 'POST',
      headers,
      body: {}
    });
    add('POST /admin/ranking/recompute-all', recomputeAll.ok, {
      status: recomputeAll.status,
      message: recomputeAll.ok ? 'ok' : JSON.stringify(recomputeAll.data).slice(0, 200)
    });

    const testTypes = ['auto_hunt', 'quality_check', 'cleaner', 'financial_sync', 'ranking_recalc'];
    for (const testType of testTypes) {
      const testRes = await request('/admin/tests/run', {
        method: 'POST',
        headers,
        body: { testType },
        timeoutMs: 90000
      });

      let extra = 'ok';
      if (testType === 'quality_check') {
        const comment = String(testRes.data?.details?.expert_comment || '');
        if (comment.includes('Ошибка AI анализа')) {
          add(`POST /admin/tests/run (${testType})`, false, {
            status: testRes.status,
            message: comment.slice(0, 220)
          });
          continue;
        }
        extra = String(testRes.data?.details?.final_class || 'no-class');
      }

      add(`POST /admin/tests/run (${testType})`, testRes.ok && testRes.data?.success !== false, {
        status: testRes.status,
        message: extra
      });

      await sleep(1500);
    }

    const testLogsAfter = await request('/admin/tests/logs', { headers });
    add('GET /admin/tests/logs (after run)', testLogsAfter.ok, {
      status: testLogsAfter.status,
      message: testLogsAfter.ok ? `logs=${Array.isArray(testLogsAfter.data) ? testLogsAfter.data.length : 0}` : 'error'
    });

    const abToggle = await request('/admin/labs/toggle-ab', {
      method: 'POST',
      headers,
      body: { test_id: 'admin_panel_smoke', enabled: true }
    });
    add('POST /admin/labs/toggle-ab', abToggle.ok, {
      status: abToggle.status,
      message: abToggle.ok ? 'ok' : JSON.stringify(abToggle.data).slice(0, 200)
    });

    const scoringGet = await request('/admin/scoring/config', { headers });
    const brandFactors = scoringGet.data?.brandFactors || {};
    const scoringSave = await request('/admin/scoring/config', {
      method: 'POST',
      headers,
      body: { brandFactors }
    });
    add('POST /admin/scoring/config', scoringSave.ok, {
      status: scoringSave.status,
      message: scoringSave.ok ? 'ok' : JSON.stringify(scoringSave.data).slice(0, 200)
    });

    const result = summary();
    const finishedAt = new Date().toISOString();
    const report = { startedAt: startTs, finishedAt, apiRoot: API_ROOT, ...result };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

    console.log(`\nReport written: ${REPORT_PATH}`);
    console.log(`Total: ${result.total}, Failed: ${result.failed}`);

    if (result.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (server.spawned) {
      server.spawned.kill('SIGTERM');
    }
  }
}

run().catch((error) => {
  console.error('verify-admin-panel-endpoints failed:', error.message);
  process.exitCode = 1;
});
