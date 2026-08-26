const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const app = require('../src/app');
const http = require('http');

let server;
let baseUrl;

let vheadToken;
let auditorToken;
let adminToken;

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`   ✓ ${message}`);
}

async function setupTestData() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Users
  const userEmails = [
    { email: 'hm_vhead@test.com', role: 'VILLAGE_HEAD', vId: 1, dId: 1 },
    { email: 'hm_auditor@test.com', role: 'AUDITOR', vId: null, dId: 1 },
    { email: 'hm_admin@test.com', role: 'ADMIN', vId: null, dId: null }
  ];

  for (const u of userEmails) {
    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, village_id, district_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, village_id = EXCLUDED.village_id, district_id = EXCLUDED.district_id
    `, [u.email, u.email, passwordHash, u.role, u.vId, u.dId]);
  }

  const login = async (email) => {
    const res = await request('POST', '/api/auth/login', { email, password: 'password123' });
    return res.body?.data?.token;
  };

  vheadToken = await login('hm_vhead@test.com');
  auditorToken = await login('hm_auditor@test.com');
  adminToken = await login('hm_admin@test.com');
}

async function runTests() {
  console.log('\n--- Running Groundwater Availability Heatmap Tests ---\n');

  // 1. Unauthenticated request rejected
  console.log('1. Testing unauthenticated request to /api/groundwater/predictions...');
  const unauthRes = await request('GET', '/api/groundwater/predictions');
  assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

  // 2. Village Head geographic scope
  console.log('2. Testing Village Head geographic heatmap predictions...');
  const vheadRes = await request('GET', '/api/groundwater/predictions', null, vheadToken);
  assert(vheadRes.status === 200, 'Village Head heatmap data retrieved (200 OK)');
  assert(vheadRes.body.data.geographicScope === 'VILLAGE', 'Scope is VILLAGE');
  assert(Array.isArray(vheadRes.body.data.predictions), 'Predictions is an array');
  assert(vheadRes.body.data.predictions.length > 0, 'Contains village prediction points');
  assert(Array.isArray(vheadRes.body.data.farms), 'Farms is an array');

  // 3. Auditor geographic scope
  console.log('3. Testing Auditor district-scoped heatmap predictions...');
  const audRes = await request('GET', '/api/groundwater/predictions', null, auditorToken);
  assert(audRes.status === 200, 'Auditor heatmap data retrieved (200 OK)');
  assert(audRes.body.data.geographicScope === 'DISTRICT', 'Scope is DISTRICT');

  // 4. Admin state-wide scope
  console.log('4. Testing Admin state-wide heatmap predictions...');
  const adminRes = await request('GET', '/api/groundwater/predictions', null, adminToken);
  assert(adminRes.status === 200, 'Admin heatmap data retrieved (200 OK)');
  assert(adminRes.body.data.geographicScope === 'STATE', 'Scope is STATE');
  assert(adminRes.body.data.predictionCount >= vheadRes.body.data.predictionCount, 'Admin sees broad region predictions');

  // 5. Verify prediction object schema & ML intensity integrity
  console.log('5. Validating prediction schema and value normalization...');
  const firstPred = adminRes.body.data.predictions[0];
  assert(typeof firstPred.latitude === 'number', 'latitude is a valid float');
  assert(typeof firstPred.longitude === 'number', 'longitude is a valid float');
  assert(typeof firstPred.predicted_gwl_meters === 'number', 'predicted_gwl_meters is numeric');
  assert(typeof firstPred.groundwaterMeter === 'number' && firstPred.groundwaterMeter >= 0 && firstPred.groundwaterMeter <= 100, 'groundwaterMeter normalized 0-100');
  assert(typeof firstPred.heat_intensity === 'number' && firstPred.heat_intensity >= 0 && firstPred.heat_intensity <= 1.0, 'heat_intensity normalized 0.0-1.0');
  assert(['HIGH AVAILABILITY', 'MODERATE AVAILABILITY', 'LOW AVAILABILITY'].includes(firstPred.condition), 'condition is properly classified');

  // 6. Verify farm overlay separation
  console.log('6. Validating farm overlay layer distinctness...');
  if (adminRes.body.data.farms.length > 0) {
    const firstFarm = adminRes.body.data.farms[0];
    assert(firstFarm.farm_id !== undefined, 'Farm has farm_id');
    assert(firstFarm.name !== undefined, 'Farm has name');
    assert(typeof firstFarm.local_gwl_meters === 'number', 'Farm has linked local ML groundwater value');
    assert(typeof firstFarm.local_gw_meter === 'number', 'Farm has linked local groundwater availability meter');
  }

  // 7. Verify /api/groundwater/heatmap alias
  console.log('7. Testing /api/groundwater/heatmap endpoint alias...');
  const aliasRes = await request('GET', '/api/groundwater/heatmap', null, adminToken);
  assert(aliasRes.status === 200, '/api/groundwater/heatmap alias returns 200 OK');

  console.log('\n========================================================================');
  console.log('ALL GROUNDWATER AVAILABILITY HEATMAP INTEGRATION TESTS PASSED!');
  console.log('========================================================================\n');
}

async function start() {
  server = app.listen(0, async () => {
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    try {
      await setupTestData();
      await runTests();
    } catch (err) {
      console.error('Test execution error:', err);
      process.exit(1);
    } finally {
      server.close();
      await pool.end();
    }
  });
}

start();
