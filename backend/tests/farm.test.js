const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const app = require('../src/app');
const http = require('http');

let server;
let baseUrl;
let vheadAToken;
let vheadBToken;
let auditorToken;
let farmAId;
let farmBId;

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runFarmTests() {
  console.log('--- Running Farm Management & Geographic Authorization Integration Tests ---\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Clean up test users & farms
    await pool.query("DELETE FROM farms WHERE name LIKE '%Test Farm%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@farm-test.com'");

    // Create Village Head A (assigned to village_id = 1: Gharaunda)
    const passHash = await bcrypt.hash('Password123!', 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, village_id) VALUES ('Head Gharaunda', 'vhead.a@farm-test.com', $1, 'VILLAGE_HEAD', 1)",
      [passHash]
    );

    // Create Village Head B (assigned to village_id = 2: Indri)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, village_id) VALUES ('Head Indri', 'vhead.b@farm-test.com', $1, 'VILLAGE_HEAD', 2)",
      [passHash]
    );

    // Create Auditor (assigned to district_id = 1)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, district_id) VALUES ('Auditor Karnal', 'auditor@farm-test.com', $1, 'AUDITOR', 1)",
      [passHash]
    );

    // Log in users
    const loginA = await request('POST', '/api/auth/login', { email: 'vhead.a@farm-test.com', password: 'Password123!' });
    vheadAToken = loginA.body.data.token;

    const loginB = await request('POST', '/api/auth/login', { email: 'vhead.b@farm-test.com', password: 'Password123!' });
    vheadBToken = loginB.body.data.token;

    const loginAud = await request('POST', '/api/auth/login', { email: 'auditor@farm-test.com', password: 'Password123!' });
    auditorToken = loginAud.body.data.token;

    // 1. Unauthenticated POST /api/farms -> 401
    console.log('1. Testing Unauthenticated POST /api/farms...');
    const res1 = await request('POST', '/api/farms', {
      name: 'Unauth Test Farm',
      village_id: 1,
      total_land_area_hectares: 2.0
    });
    if (res1.status !== 401) {
      throw new Error(`Test 1 Failed: Expected 401 Unauthorized but got ${res1.status}`);
    }
    console.log('   ✓ Unauthenticated request rejected (401 Unauthorized)');

    // 2. Non-VILLAGE_HEAD role (AUDITOR) access -> 403
    console.log('2. Testing Non-VILLAGE_HEAD role accessing /api/farms...');
    const res2 = await request('GET', '/api/farms', null, auditorToken);
    if (res2.status !== 403) {
      throw new Error(`Test 2 Failed: Expected 403 Forbidden for AUDITOR but got ${res2.status}`);
    }
    console.log('   ✓ Non-Village Head role correctly rejected (403 Forbidden)');

    // 3. Village Head A creates farm in Village 1 -> 201 Created (success)
    console.log('3. Village Head A creating farm in assigned Village 1...');
    const res3 = await request('POST', '/api/farms', {
      name: 'Gharaunda Test Farm A',
      owner_name: 'Harish Kumar',
      village_id: 1,
      total_land_area_hectares: 3.5
    }, vheadAToken);
    if (res3.status !== 201 || !res3.body?.data?.farm?.farm_id) {
      throw new Error(`Test 3 Failed: ${JSON.stringify(res3.body)}`);
    }
    farmAId = res3.body.data.farm.farm_id;
    console.log(`   ✓ Farm created in Village 1 (ID: ${farmAId}) (201 Created)`);

    // Village Head B creates farm in Village 2
    const res3b = await request('POST', '/api/farms', {
      name: 'Indri Test Farm B',
      owner_name: 'Suresh Verma',
      village_id: 2,
      total_land_area_hectares: 4.2
    }, vheadBToken);
    farmBId = res3b.body.data.farm.farm_id;

    // 4. Village Head A attempts to create farm in Village 2 -> 403 Forbidden
    console.log('4. Village Head A attempting to create farm in Village 2 (outside jurisdiction)...');
    const res4 = await request('POST', '/api/farms', {
      name: 'Illegal Cross-Village Farm',
      owner_name: 'Illegal Owner',
      village_id: 2,
      total_land_area_hectares: 1.5
    }, vheadAToken);
    if (res4.status !== 403) {
      throw new Error(`Test 4 Failed: Expected 403 Forbidden for cross-village creation but got ${res4.status}`);
    }
    console.log('   ✓ Cross-village farm creation rejected (403 Forbidden)');

    // 5. Village Head A loads farms -> only Village 1 farms returned
    console.log('5. Village Head A loading all farms...');
    const res5 = await request('GET', '/api/farms', null, vheadAToken);
    if (res5.status !== 200) {
      throw new Error(`Test 5 Failed: Expected 200 OK but got ${res5.status}`);
    }
    const farmsA = res5.body?.data?.farms;
    const allInVillage1 = farmsA.every(f => f.village_id === 1);
    const containsFarmB = farmsA.some(f => f.farm_id === farmBId);
    if (!allInVillage1 || containsFarmB) {
      throw new Error('Test 5 Failed: Village Head A received farms outside Village 1!');
    }
    console.log(`   ✓ List filtered strictly to Village 1 (${farmsA.length} farms returned) (200 OK)`);

    // 6. Village Head A gets their own farm (Farm A) -> 200 OK
    console.log(`6. Village Head A retrieving their own farm (Farm ID: ${farmAId})...`);
    const res6 = await request('GET', `/api/farms/${farmAId}`, null, vheadAToken);
    if (res6.status !== 200 || res6.body?.data?.farm?.name !== 'Gharaunda Test Farm A') {
      throw new Error(`Test 6 Failed: ${JSON.stringify(res6.body)}`);
    }
    console.log('   ✓ Own farm retrieved successfully (200 OK)');

    // 7. Village Head A attempts to get Village 2 farm (Farm B) -> 403 Forbidden (IDOR prevention)
    console.log(`7. Village Head A attempting to retrieve Farm B in Village 2 (ID: ${farmBId})...`);
    const res7 = await request('GET', `/api/farms/${farmBId}`, null, vheadAToken);
    if (res7.status !== 403) {
      throw new Error(`Test 7 Failed: Expected 403 Forbidden for IDOR attempt but got ${res7.status}`);
    }
    console.log('   ✓ IDOR access attempt blocked across village boundary (403 Forbidden)');

    // 8. Village Head A updates their own farm -> 200 OK
    console.log(`8. Village Head A updating their own farm (Farm ID: ${farmAId})...`);
    const res8 = await request('PUT', `/api/farms/${farmAId}`, {
      name: 'Gharaunda Test Farm A (Updated)',
      total_land_area_hectares: 5.0
    }, vheadAToken);
    if (res8.status !== 200 || res8.body?.data?.farm?.name !== 'Gharaunda Test Farm A (Updated)') {
      throw new Error(`Test 8 Failed: ${JSON.stringify(res8.body)}`);
    }
    console.log('   ✓ Farm updated successfully (200 OK)');

    // 9. Village Head A attempts to update Village 2 farm (Farm B) -> 403 Forbidden
    console.log(`9. Village Head A attempting to update Farm B in Village 2...`);
    const res9 = await request('PUT', `/api/farms/${farmBId}`, {
      name: 'Hacked Name'
    }, vheadAToken);
    if (res9.status !== 403) {
      throw new Error(`Test 9 Failed: Expected 403 Forbidden for unauthorized update but got ${res9.status}`);
    }
    console.log('   ✓ Unauthorized update across village boundary rejected (403 Forbidden)');

    // 10. Village Head A attempts to change farm's village_id -> 400 Bad Request
    console.log(`10. Village Head A attempting to move farm to another village_id...`);
    const res10 = await request('PUT', `/api/farms/${farmAId}`, {
      village_id: 2
    }, vheadAToken);
    if (res10.status !== 400) {
      throw new Error(`Test 10 Failed: Expected 400 Bad Request for immutable village_id change but got ${res10.status}`);
    }
    console.log('   ✓ Immutable village_id change correctly rejected (400 Bad Request)');

    // 11. Invalid farm data on creation -> 400 Bad Request
    console.log('11. Testing validation: missing name and invalid area...');
    const res11a = await request('POST', '/api/farms', {
      village_id: 1,
      total_land_area_hectares: 2.0
    }, vheadAToken);
    if (res11a.status !== 400) {
      throw new Error(`Test 11a Failed: Missing name should return 400, got ${res11a.status}`);
    }

    const res11b = await request('POST', '/api/farms', {
      name: 'Negative Area Farm',
      village_id: 1,
      total_land_area_hectares: -5.0
    }, vheadAToken);
    if (res11b.status !== 400) {
      throw new Error(`Test 11b Failed: Negative area should return 400, got ${res11b.status}`);
    }
    console.log('   ✓ Invalid input payloads correctly rejected (400 Bad Request)');

    // 12. Nonexistent farm lookup -> 404 Not Found
    console.log('12. Testing non-existent farm lookup (ID: 999999)...');
    const res12 = await request('GET', '/api/farms/999999', null, vheadAToken);
    if (res12.status !== 404) {
      throw new Error(`Test 12 Failed: Expected 404 Not Found but got ${res12.status}`);
    }
    console.log('   ✓ Non-existent farm correctly rejected (404 Not Found)');

    console.log('\n===============================================================');
    console.log('ALL 12 FARM MANAGEMENT & GEOGRAPHIC AUTHORIZATION TESTS PASSED!');
    console.log('===============================================================\n');

  } finally {
    await pool.query("DELETE FROM farms WHERE name LIKE '%Test Farm%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@farm-test.com'");
    await pool.end();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

runFarmTests().catch(err => {
  console.error('Farm Test Suite Error:', err);
  process.exit(1);
});
