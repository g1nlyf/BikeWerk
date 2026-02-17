/* eslint-disable no-console */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const BetterSqlite3 = require('better-sqlite3');

const TEST_DB_PATH = path.resolve(__dirname, 'tmp_phase2_e2e_smoke.db');
const PORT = 8093;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const ADMIN_EMAIL = 'hackerios222@gmail.com';
const ADMIN_PASSWORD = '12345678';

function cleanupDbFiles(dbPath) {
  const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  for (const file of files) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore
    }
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(urlPath, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

async function waitForHealth(timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const health = await requestJson('/health');
      if (health.ok && health.data?.success) return true;
    } catch {
      // ignore
    }
    await sleep(1000);
  }
  return false;
}

function seedBike(dbPath) {
  const db = new BetterSqlite3(dbPath);
  try {
    const nowIso = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO bikes (
        name, brand, model, year, price, category, is_active, source_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    const result = insert.run(
      'Smoke Test Bike',
      'Cube',
      'Stereo',
      2022,
      1800,
      'mtb',
      'https://example.com/smoke-bike',
      nowIso,
      nowIso
    );
    return Number(result.lastInsertRowid);
  } finally {
    db.close();
  }
}

function seedSignal(dbPath, orderCode) {
  const db = new BetterSqlite3(dbPath);
  try {
    const nowIso = new Date().toISOString();
    const id = `AIS-SMOKE-${Date.now()}`;
    const insert = db.prepare(`
      INSERT INTO ai_signals (
        id, signal_type, source, severity, status, owner_circle, entity_type, entity_id,
        title, insight, target, payload, dedupe_key, assigned_to, priority_score,
        first_seen_at, last_seen_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      id,
      'smoke_signal',
      'test',
      'high',
      'open',
      'sales_ops',
      'order',
      String(orderCode || 'ORD-SMOKE'),
      'Smoke signal',
      'Signal for e2e decision test',
      '/admin#action-center',
      JSON.stringify({ smoke: true }),
      `smoke:${orderCode || 'ord'}`,
      null,
      50,
      nowIso,
      nowIso,
      nowIso,
      nowIso
    );
    return id;
  } finally {
    db.close();
  }
}

async function run() {
  cleanupDbFiles(TEST_DB_PATH);

  const env = {
    ...process.env,
    DB_PATH: TEST_DB_PATH,
    BOT_DB_PATH: TEST_DB_PATH,
    PORT: String(PORT),
    ENABLE_AI_ROP_AUTOPILOT: '0',
    ENABLE_CRM_HOURLY_SYNC: '0',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_KEY: ''
  };

  const server = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '../../'),
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logs = [];
  server.stdout.on('data', (chunk) => logs.push(String(chunk || '')));
  server.stderr.on('data', (chunk) => logs.push(String(chunk || '')));

  try {
    const healthy = await waitForHealth();
    assert.ok(healthy, 'Server failed to reach healthy state in time');

    const bikeId = seedBike(TEST_DB_PATH);
    assert.ok(Number.isFinite(bikeId) && bikeId > 0, 'Failed to seed bike');

    const booking = await requestJson('/v1/booking', {
      method: 'POST',
      body: {
        bike_id: bikeId,
        customer: {
          name: 'Smoke User',
          email: 'smoke.user@example.com',
          phone: '+79990001122'
        },
        bike_details: {
          title: 'Smoke Test Bike',
          price_eur: 1800,
          url: 'https://example.com/smoke-bike'
        },
        delivery_method: 'Cargo'
      }
    });
    assert.ok(booking.ok, `Booking failed: ${JSON.stringify(booking.data)}`);
    assert.strictEqual(booking.data?.success, true, 'Booking success=false');
    assert.ok(booking.data?.order_code, 'Booking order_code missing');
    assert.strictEqual(booking.data?.storage_mode, 'local_primary', 'Booking must be local_primary');

    const orderCode = String(booking.data.order_code);

    const reserve = await requestJson(`/v1/orders/${encodeURIComponent(orderCode)}/reserve`, {
      method: 'POST'
    });
    assert.ok(reserve.ok, `Reserve failed: ${JSON.stringify(reserve.data)}`);
    assert.strictEqual(reserve.data?.status, 'reserve_paid', 'Reserve status must be reserve_paid');
    assert.strictEqual(reserve.data?.storage_mode, 'local_primary', 'Reserve must be local_primary');

    const login = await requestJson('/auth/login', {
      method: 'POST',
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      }
    });
    assert.ok(login.ok, `Admin login failed: ${JSON.stringify(login.data)}`);
    const token = login.data?.token;
    assert.ok(token, 'Admin token missing');

    const authHeaders = { Authorization: `Bearer ${token}` };

    const statusStep1 = await requestJson(`/v1/crm/orders/${encodeURIComponent(orderCode)}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: { status: 'full_payment_pending', note: 'e2e step 1' }
    });
    assert.ok(statusStep1.ok, `Single status update failed: ${JSON.stringify(statusStep1.data)}`);

    const bulkInvalid = await requestJson('/v1/crm/orders/bulk/status', {
      method: 'PATCH',
      headers: authHeaders,
      body: {
        order_ids: [orderCode],
        status: 'shipped_to_russia',
        note: 'invalid transition should fail'
      }
    });
    assert.strictEqual(bulkInvalid.status, 400, 'Invalid bulk transition must return 400');

    const bulkValid = await requestJson('/v1/crm/orders/bulk/status', {
      method: 'PATCH',
      headers: authHeaders,
      body: {
        order_ids: [orderCode],
        status: 'full_payment_received',
        note: 'valid transition'
      }
    });
    assert.ok(bulkValid.ok, `Valid bulk transition failed: ${JSON.stringify(bulkValid.data)}`);
    assert.strictEqual(bulkValid.data?.storage_mode, 'local_primary', 'Bulk update should be local_primary');

    const seededSignalId = seedSignal(TEST_DB_PATH, orderCode);

    const signalsList = await requestJson('/admin/ai-signals', {
      method: 'GET',
      headers: authHeaders
    });
    assert.ok(signalsList.ok, `AI signals list failed: ${JSON.stringify(signalsList.data)}`);
    assert.ok(Array.isArray(signalsList.data?.signals), 'AI signals list must be array');

    const decision = await requestJson(`/admin/ai-signals/${encodeURIComponent(seededSignalId)}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        decision: 'approve',
        note: 'e2e approve'
      }
    });
    assert.ok(decision.ok, `AI signal decision failed: ${JSON.stringify(decision.data)}`);
    assert.strictEqual(decision.data?.result?.signal_status, 'in_progress', 'Approve must move signal to in_progress');

    const decisionsList = await requestJson(`/admin/ai-signals/${encodeURIComponent(seededSignalId)}/decisions`, {
      method: 'GET',
      headers: authHeaders
    });
    assert.ok(decisionsList.ok, `AI signal decisions list failed: ${JSON.stringify(decisionsList.data)}`);
    assert.ok(Array.isArray(decisionsList.data?.decisions) && decisionsList.data.decisions.length >= 1, 'Signal decisions must be present');

    const workspace = await requestJson('/admin/workspace?period=7d', {
      method: 'GET',
      headers: authHeaders
    });
    assert.ok(workspace.ok, `Workspace failed: ${JSON.stringify(workspace.data)}`);
    assert.ok(Array.isArray(workspace.data?.ceo?.ai_signals), 'Workspace ceo.ai_signals must be array');

    console.log('[PASS] CRM Phase-2 E2E smoke completed');
  } finally {
    try {
      server.kill('SIGTERM');
    } catch {
      // ignore
    }
    await sleep(1500);
  }
}

run().catch((error) => {
  console.error('[FAIL] CRM Phase-2 E2E smoke failed:', error?.message || error);
  process.exit(1);
});
