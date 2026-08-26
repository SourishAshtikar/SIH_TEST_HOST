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
  const email = 'gw_test_user@example.com';

  await pool.query(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, ['GW Tester', email, passwordHash, 'ADMIN']);

  const res = await request('POST', '/api/auth/login', { email, password: 'password123' });
  token = res.body?.data?.token;
  if (!token) {
    throw new Error('Failed to log in and retrieve auth token for tests');
  }
}

async function runTests() {
  console.log('\n--- Running Groundwater Assessment GIS API Tests ---\n');

  // 1. Unauthenticated request rejected
  console.log('1. Testing unauthenticated request to /api/groundwater-assessments...');
  const unauthRes = await request('GET', '/api/groundwater-assessments');
  assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

  // 2. Missing year param rejected
  console.log('2. Testing missing year parameter...');
  const missingYearRes = await request('GET', '/api/groundwater-assessments', null, token);
  assert(missingYearRes.status === 400, 'Missing year parameter rejected with 400 Bad Request');
  assert(missingYearRes.body.message.includes('year'), 'Error message mentions year parameter');

  // 3. Retrieve list of assessments for 2023-2024 (district scope)
  console.log('3. Testing retrieve district assessments list for 2023-2024...');
  const distListRes = await request('GET', '/api/groundwater-assessments?year=2023-2024&scope=district', null, token);
  assert(distListRes.status === 200, 'District assessments list retrieved (200 OK)');
  assert(distListRes.body.status === 'SUCCESS', 'Response status is SUCCESS');
  assert(Array.isArray(distListRes.body.data), 'Data is an array');
  assert(distListRes.body.data.length > 0, 'Contains multiple district assessments');
  const firstDist = distListRes.body.data[0];
  assert(firstDist.district_id !== undefined, 'Record has district_id');
  assert(firstDist.district_name !== undefined, 'Record has district_name');
  assert(firstDist.category !== undefined, 'Record has category');
  assert(firstDist.is_predicted === false, '2023-2024 is historical (is_predicted = false)');

  // 4. Retrieve list of assessments for 2025-2026 (predicted, village scope)
  console.log('4. Testing retrieve village assessments list for 2025-2026 (predicted)...');
  const villListRes = await request('GET', '/api/groundwater-assessments?year=2025-2026&scope=village', null, token);
  assert(villListRes.status === 200, 'Village assessments list retrieved (200 OK)');
  assert(Array.isArray(villListRes.body.data), 'Data is an array');
  assert(villListRes.body.data.length > 0, 'Contains village assessments');
  const firstVill = villListRes.body.data[0];
  assert(firstVill.village_id !== undefined, 'Record has village_id');
  assert(firstVill.village_name !== undefined, 'Record has village_name');
  assert(firstVill.district_name !== undefined, 'Record has parent district name');
  assert(firstVill.latitude !== undefined, 'Record has latitude');
  assert(firstVill.is_predicted === true, '2025-2026 is predicted (is_predicted = true)');

  // 5. Retrieve State-level Details
  console.log('5. Testing retrieve State-level aggregated details (no ID)...');
  const stateDetailsRes = await request('GET', '/api/groundwater-assessments/details?year=2024-2025&scope=state', null, token);
  assert(stateDetailsRes.status === 200, 'State details retrieved (200 OK)');
  const stateData = stateDetailsRes.body.data;
  assert(stateData.focusName === 'Haryana', 'Focus name is Haryana');
  assert(stateData.focusType === 'STATE', 'Focus type is STATE');
  assert(stateData.extractable_resources_bcm > 0, 'Aggregate extractable resources is positive');
  assert(stateData.extraction_all_uses_bcm > 0, 'Aggregate extraction is positive');
  assert(stateData.stage_of_extraction_pct > 0, 'Aggregate stage of extraction computed');
  assert(Array.isArray(stateData.subRegions) && stateData.subRegions.length > 0, 'Returns list of district sub-regions');
  const subDist = stateData.subRegions[0];
  assert(subDist.name !== undefined, 'Sub-region has name');
  assert(subDist.extractable_resources_bcm !== undefined, 'Sub-region has extractable_resources_bcm');

  // 6. Retrieve District-level Details
  console.log('6. Testing retrieve district-level details with ID...');
  const distDetailsRes = await request('GET', '/api/groundwater-assessments/details?year=2024-2025&scope=district&id=1', null, token);
  assert(distDetailsRes.status === 200, 'District details retrieved (200 OK)');
  const distData = distDetailsRes.body.data;
  assert(distData.focusName === 'Karnal', 'Focus name is Karnal');
  assert(distData.focusType === 'DISTRICT', 'Focus type is DISTRICT');
  assert(distData.breadcrumbs.includes('KARNAL'), 'Breadcrumbs include district name');
  assert(distData.category !== null, 'District has a specific classification category');
  assert(Array.isArray(distData.subRegions) && distData.subRegions.length > 0, 'Returns list of village sub-regions');
  const subVill = distData.subRegions[0];
  assert(subVill.name !== undefined, 'Sub-region village has name');
  assert(subVill.extractable_resources_bcm !== undefined, 'Sub-region village has resources');

  // 7. Retrieve Village-level Details
  console.log('7. Testing retrieve village-level details with ID...');
  const villDetailsRes = await request('GET', '/api/groundwater-assessments/details?year=2024-2025&scope=village&id=1', null, token);
  assert(villDetailsRes.status === 200, 'Village details retrieved (200 OK)');
  const villData = villDetailsRes.body.data;
  assert(villData.focusName === 'Gharaunda', 'Focus name is Gharaunda');
  assert(villData.focusType === 'VILLAGE', 'Focus type is VILLAGE');
  assert(villData.breadcrumbs.includes('KARNAL') && villData.breadcrumbs.includes('GHARAUNDA'), 'Breadcrumbs include district and village name');

  console.log('\n========================================================================');
  console.log('ALL GROUNDWATER ASSESSMENT API INTEGRATION TESTS PASSED!');
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
