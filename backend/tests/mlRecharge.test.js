const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const app = require('../src/app');
const http = require('http');

let server;
let baseUrl;
let token;

async function request(method, path, body = null, authToken = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

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
  const email = 'ml_recharge_tester@example.com';

  await pool.query(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, ['ML Tester', email, passwordHash, 'ADMIN']);

  const res = await request('POST', '/api/auth/login', { email, password: 'password123' });
  token = res.body?.data?.token;
  if (!token) {
    throw new Error('Failed to log in and retrieve auth token for tests');
  }
}

async function runTests() {
  console.log('\n--- Running ML Groundwater Recharge & Irrigation Recommendation Tests ---\n');

  // 1. Dynamic assessment years API endpoint
  console.log('1. Testing retrieve unique assessment years...');
  const yearsRes = await request('GET', '/api/groundwater-assessments/years', null, token);
  assert(yearsRes.status === 200, 'Endpoint returned 200 OK');
  assert(yearsRes.body.status === 'SUCCESS', 'Response status is SUCCESS');
  assert(Array.isArray(yearsRes.body.data.years), 'Response data contains years array');
  assert(yearsRes.body.data.years.includes('2023-2024'), 'Includes historical 2023-2024 data');
  assert(yearsRes.body.data.years.includes('2025-2026'), 'Includes predicted 2025-2026 data');

  // 2. Real DTW retrieved from database
  console.log('2. Testing retrieve district details with database-loaded DTW...');
  const detailsRes = await request('GET', '/api/groundwater-assessments/details?scope=district&id=1&year=2025-2026', null, token);
  assert(detailsRes.status === 200, 'Endpoint returned 200 OK');
  assert(detailsRes.body.status === 'SUCCESS', 'Response status is SUCCESS');
  assert(typeof detailsRes.body.data.dtw_m_bgl === 'number', 'dtw_m_bgl is returned as a number');
  assert(detailsRes.body.data.dtw_m_bgl > 0, 'dtw_m_bgl has positive real depth value');

  // 3. ML Integrated recommendation engine
  console.log('3. Testing ML integrated technique recommendation request...');
  const recRes = await request('POST', '/api/recommendations', {
    villageId: 1, // Gharaunda (associated with Karnal district, which has predictions)
    cropName: 'Rice',
    currentPracticeName: 'Flood'
  }, token);
  assert(recRes.status === 200, 'Recommendation endpoint returned 200 OK');
  assert(recRes.body.status === 'SUCCESS', 'Response status is SUCCESS');
  assert(recRes.body.data.recommendedPractice !== undefined, 'recommendedPractice is defined');
  assert(typeof recRes.body.data.confidenceScore === 'number', 'confidenceScore is returned as a number');
  assert(Array.isArray(recRes.body.data.reasons), 'Reasons is an array');
  
  // Verify ML model reasoning is included in reasons
  const hasMLReason = recRes.body.data.reasons.some(r => r.includes('ML model') || r.includes('confidence'));
  assert(hasMLReason, 'Reasons list contains ML classifier-specific reasoning');

  console.log('\n========================================================================');
  console.log('ALL ML GROUNDWATER RECHARGE & INTEGRATION INTEGRATION TESTS PASSED!');
  console.log('========================================================================\n');
}

// Start local server to run tests against
const PORT = 3001; // use separate port for test server
server = http.createServer(app);
server.listen(PORT, '127.0.0.1', async () => {
  baseUrl = `http://127.0.0.1:${PORT}`;
  try {
    await setupTestData();
    await runTests();
    server.close();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    server.close();
    await pool.end();
    process.exit(1);
  }
});
