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
let auditorAToken;
let auditorBToken;

let farmV1Id;
let farmV2Id;
let farmV3Id;

let recordV1Id;
let recordV2Id;
let recordV3Id;

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

async function runCropRecordTests() {
  console.log('--- Running Seasonal Crop Record & Geographic Authorization Integration Tests ---\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 0. Clean up previous test records
    await pool.query("DELETE FROM farm_crop_records WHERE agricultural_year LIKE '2026-CR-TEST%'");
    await pool.query("DELETE FROM farms WHERE name LIKE '%CR Test Farm%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@cr-test.com'");

    const passHash = await bcrypt.hash('Password123!', 10);

    // Setup Village Head A (Village 1: Gharaunda in District 1: Karnal)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, village_id) VALUES ('Head Gharaunda', 'vhead.a@cr-test.com', $1, 'VILLAGE_HEAD', 1)",
      [passHash]
    );

    // Setup Village Head B (Village 2: Indri in District 1: Karnal)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, village_id) VALUES ('Head Indri', 'vhead.b@cr-test.com', $1, 'VILLAGE_HEAD', 2)",
      [passHash]
    );

    // Setup Auditor A (District 1: Karnal)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, district_id) VALUES ('Auditor Karnal', 'auditor.a@cr-test.com', $1, 'AUDITOR', 1)",
      [passHash]
    );

    // Setup Auditor B (District 2: Kurukshetra)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, district_id) VALUES ('Auditor Kurukshetra', 'auditor.b@cr-test.com', $1, 'AUDITOR', 2)",
      [passHash]
    );

    // Log in test users
    const loginVHA = await request('POST', '/api/auth/login', { email: 'vhead.a@cr-test.com', password: 'Password123!' });
    vheadAToken = loginVHA.body.data.token;

    const loginVHB = await request('POST', '/api/auth/login', { email: 'vhead.b@cr-test.com', password: 'Password123!' });
    vheadBToken = loginVHB.body.data.token;

    const loginAudA = await request('POST', '/api/auth/login', { email: 'auditor.a@cr-test.com', password: 'Password123!' });
    auditorAToken = loginAudA.body.data.token;

    const loginAudB = await request('POST', '/api/auth/login', { email: 'auditor.b@cr-test.com', password: 'Password123!' });
    auditorBToken = loginAudB.body.data.token;

    // Create Farm in Village 1 (District 1)
    const f1 = await pool.query(
      "INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares) VALUES ('CR Test Farm V1', 'Kisan V1', 1, 5.0) RETURNING farm_id"
    );
    farmV1Id = f1.rows[0].farm_id;

    // Create Farm in Village 2 (District 1)
    const f2 = await pool.query(
      "INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares) VALUES ('CR Test Farm V2', 'Kisan V2', 2, 4.0) RETURNING farm_id"
    );
    farmV2Id = f2.rows[0].farm_id;

    // Create Farm in Village 3 (District 2: Pehowa)
    const f3 = await pool.query(
      "INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares) VALUES ('CR Test Farm V3', 'Kisan V3', 3, 6.0) RETURNING farm_id"
    );
    farmV3Id = f3.rows[0].farm_id;

    // ==========================================
    // AUTHENTICATION TESTS
    // ==========================================
    console.log('1. Testing POST /api/farms/:id/crop-records without JWT...');
    const res1 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 1, agricultural_year: '2026-CR-TEST', crop_id: 1, cultivated_area_hectares: 2.0
    });
    if (res1.status !== 401) throw new Error(`Test 1 Failed: Expected 401 Unauthorized but got ${res1.status}`);
    console.log('   ✓ Missing JWT token rejected (401 Unauthorized)');

    console.log('2. Testing POST /api/farms/:id/crop-records with invalid JWT...');
    const res2 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 1, agricultural_year: '2026-CR-TEST', crop_id: 1, cultivated_area_hectares: 2.0
    }, 'invalid.bearer.token');
    if (res2.status !== 401) throw new Error(`Test 2 Failed: Expected 401 Unauthorized but got ${res2.status}`);
    console.log('   ✓ Invalid JWT token rejected (401 Unauthorized)');

    // ==========================================
    // CREATE RECORD TESTS
    // ==========================================
    console.log('3. Village Head A creating record for own-village farm (Village 1)...');
    const res3 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 1, // Kharif
      agricultural_year: '2026-CR-TEST',
      crop_id: 1, // Rice
      cultivated_area_hectares: 3.5,
      current_irrigation_method_id: 1 // Flood Irrigation
    }, vheadAToken);
    if (res3.status !== 201 || !res3.body?.data?.record?.record_id) {
      throw new Error(`Test 3 Failed: ${JSON.stringify(res3.body)}`);
    }
    recordV1Id = res3.body.data.record.record_id;
    console.log(`   ✓ Crop record created successfully in Village 1 (ID: ${recordV1Id}) (201 Created)`);

    // Village Head B creates record for Farm in Village 2
    const resVHB = await request('POST', `/api/farms/${farmV2Id}/crop-records`, {
      season_id: 1,
      agricultural_year: '2026-CR-TEST',
      crop_id: 2, // Wheat
      cultivated_area_hectares: 2.5,
      current_irrigation_method_id: 2
    }, vheadBToken);
    recordV2Id = resVHB.body.data.record.record_id;

    // Create record directly in DB for Village 3 in District 2
    const resRec3 = await pool.query(
      "INSERT INTO farm_crop_records (farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id) VALUES ($1, 1, '2026-CR-TEST', 3, 4.0, 3) RETURNING record_id",
      [farmV3Id]
    );
    recordV3Id = resRec3.rows[0].record_id;

    console.log('4. Village Head A attempting to create record for Farm in Village 2 (cross-village)...');
    const res4 = await request('POST', `/api/farms/${farmV2Id}/crop-records`, {
      season_id: 2,
      agricultural_year: '2026-CR-TEST',
      crop_id: 2,
      cultivated_area_hectares: 1.5
    }, vheadAToken);
    if (res4.status !== 403) throw new Error(`Test 4 Failed: Expected 403 Forbidden for cross-village creation but got ${res4.status}`);
    console.log('   ✓ Cross-village crop record creation rejected (403 Forbidden)');

    console.log('5. Testing nonexistent farm creation (ID: 999999)...');
    const res5 = await request('POST', '/api/farms/999999/crop-records', {
      season_id: 1,
      agricultural_year: '2026-CR-TEST',
      crop_id: 1,
      cultivated_area_hectares: 1.0
    }, vheadAToken);
    if (res5.status !== 404) throw new Error(`Test 5 Failed: Expected 404 Not Found for missing farm but got ${res5.status}`);
    console.log('   ✓ Non-existent farm rejected (404 Not Found)');

    console.log('6. Testing invalid season_id...');
    const res6 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 999999,
      agricultural_year: '2026-CR-TEST-2',
      crop_id: 1,
      cultivated_area_hectares: 2.0
    }, vheadAToken);
    if (res6.status !== 400) throw new Error(`Test 6 Failed: Expected 400 Bad Request for invalid season but got ${res6.status}`);
    console.log('   ✓ Invalid season_id rejected (400 Bad Request)');

    console.log('7. Testing invalid crop_id...');
    const res7 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 1,
      agricultural_year: '2026-CR-TEST-2',
      crop_id: 999999,
      cultivated_area_hectares: 2.0
    }, vheadAToken);
    if (res7.status !== 400) throw new Error(`Test 7 Failed: Expected 400 Bad Request for invalid crop but got ${res7.status}`);
    console.log('   ✓ Invalid crop_id rejected (400 Bad Request)');

    console.log('8. Testing invalid irrigation method ID...');
    const res8 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 1,
      agricultural_year: '2026-CR-TEST-2',
      crop_id: 1,
      cultivated_area_hectares: 2.0,
      current_irrigation_method_id: 999999
    }, vheadAToken);
    if (res8.status !== 400) throw new Error(`Test 8 Failed: Expected 400 Bad Request for invalid irrigation method but got ${res8.status}`);
    console.log('   ✓ Invalid irrigation method ID rejected (400 Bad Request)');

    console.log('9. Testing invalid cultivated area (<= 0)...');
    const res9 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 1,
      agricultural_year: '2026-CR-TEST-2',
      crop_id: 1,
      cultivated_area_hectares: -2.5
    }, vheadAToken);
    if (res9.status !== 400) throw new Error(`Test 9 Failed: Expected 400 Bad Request for negative area but got ${res9.status}`);
    console.log('   ✓ Negative / zero cultivated area rejected (400 Bad Request)');

    console.log('10. Testing duplicate (farm_id, season_id, agricultural_year, crop_id) record...');
    const res10 = await request('POST', `/api/farms/${farmV1Id}/crop-records`, {
      season_id: 1,
      agricultural_year: '2026-CR-TEST',
      crop_id: 1,
      cultivated_area_hectares: 4.0
    }, vheadAToken);
    if (res10.status !== 409) throw new Error(`Test 10 Failed: Expected 409 Conflict for duplicate record but got ${res10.status}`);
    console.log('   ✓ Duplicate crop record combination rejected (409 Conflict)');

    // ==========================================
    // READ RECORD TESTS
    // ==========================================
    console.log(`11. Village Head A listing crop records for Farm ${farmV1Id}...`);
    const res11 = await request('GET', `/api/farms/${farmV1Id}/crop-records`, null, vheadAToken);
    if (res11.status !== 200 || !Array.isArray(res11.body?.data?.records)) {
      throw new Error(`Test 11 Failed: ${JSON.stringify(res11.body)}`);
    }
    console.log(`   ✓ Crop records listed successfully (${res11.body.data.records.length} records returned) (200 OK)`);

    console.log(`12. Village Head A attempting to list records for Farm ${farmV2Id} in Village 2...`);
    const res12 = await request('GET', `/api/farms/${farmV2Id}/crop-records`, null, vheadAToken);
    if (res12.status !== 403) throw new Error(`Test 12 Failed: Expected 403 Forbidden for cross-village list but got ${res12.status}`);
    console.log('   ✓ Cross-village farm records listing blocked (403 Forbidden)');

    console.log(`13. Village Head A retrieving single crop record (ID: ${recordV1Id})...`);
    const res13 = await request('GET', `/api/crop-records/${recordV1Id}`, null, vheadAToken);
    if (res13.status !== 200 || res13.body?.data?.record?.record_id !== recordV1Id) {
      throw new Error(`Test 13 Failed: ${JSON.stringify(res13.body)}`);
    }
    console.log('   ✓ Own crop record retrieved successfully (200 OK)');

    console.log(`14. Village Head A attempting to retrieve crop record ${recordV2Id} in Village 2 (IDOR test)...`);
    const res14 = await request('GET', `/api/crop-records/${recordV2Id}`, null, vheadAToken);
    if (res14.status !== 403) throw new Error(`Test 14 Failed: Expected 403 Forbidden for cross-village read but got ${res14.status}`);
    console.log('   ✓ Cross-village crop record retrieval blocked (403 Forbidden - IDOR Protected)');

    console.log('15. Testing nonexistent crop record lookup (ID: 999999)...');
    const res15 = await request('GET', '/api/crop-records/999999', null, vheadAToken);
    if (res15.status !== 404) throw new Error(`Test 15 Failed: Expected 404 Not Found for missing record but got ${res15.status}`);
    console.log('   ✓ Nonexistent record correctly returned (404 Not Found)');

    // ==========================================
    // UPDATE RECORD TESTS
    // ==========================================
    console.log(`16. Village Head A updating crop record (ID: ${recordV1Id})...`);
    const res16 = await request('PUT', `/api/crop-records/${recordV1Id}`, {
      cultivated_area_hectares: 4.8,
      current_irrigation_method_id: 2
    }, vheadAToken);
    if (res16.status !== 200 || parseFloat(res16.body?.data?.record?.cultivated_area_hectares) !== 4.8) {
      throw new Error(`Test 16 Failed: ${JSON.stringify(res16.body)}`);
    }
    console.log('   ✓ Crop record updated successfully (200 OK)');

    console.log(`17. Village Head A attempting to update crop record ${recordV2Id} in Village 2...`);
    const res17 = await request('PUT', `/api/crop-records/${recordV2Id}`, {
      cultivated_area_hectares: 5.0
    }, vheadAToken);
    if (res17.status !== 403) throw new Error(`Test 17 Failed: Expected 403 Forbidden for cross-village update but got ${res17.status}`);
    console.log('   ✓ Cross-village crop record modification blocked (403 Forbidden)');

    console.log('18. Attempting to change farm_id during PUT update...');
    const res18 = await request('PUT', `/api/crop-records/${recordV1Id}`, {
      farm_id: farmV2Id
    }, vheadAToken);
    if (res18.status !== 400) throw new Error(`Test 18 Failed: Expected 400 Bad Request for immutable farm_id change but got ${res18.status}`);
    console.log('   ✓ Farm ID immutability verified (400 Bad Request)');

    console.log('19. Testing invalid update data (negative cultivated area)...');
    const res19 = await request('PUT', `/api/crop-records/${recordV1Id}`, {
      cultivated_area_hectares: -1.0
    }, vheadAToken);
    if (res19.status !== 400) throw new Error(`Test 19 Failed: Expected 400 Bad Request for negative area but got ${res19.status}`);
    console.log('   ✓ Invalid update payload rejected (400 Bad Request)');

    // ==========================================
    // AUDITOR ACCESS TESTS
    // ==========================================
    console.log('20. Auditor attempting to modify a seasonal crop record...');
    const res20 = await request('PUT', `/api/crop-records/${recordV1Id}`, {
      cultivated_area_hectares: 10.0
    }, auditorAToken);
    if (res20.status !== 403) throw new Error(`Test 20 Failed: Expected 403 Forbidden for Auditor write but got ${res20.status}`);
    console.log('   ✓ Auditor write access to crop records blocked (403 Forbidden)');

    console.log(`21. Auditor A reading crop record ${recordV1Id} in assigned District 1...`);
    const res21 = await request('GET', `/api/crop-records/${recordV1Id}`, null, auditorAToken);
    if (res21.status !== 200 || res21.body?.data?.record?.district_name !== 'Karnal') {
      throw new Error(`Test 21 Failed: ${JSON.stringify(res21.body)}`);
    }
    console.log('   ✓ Auditor A retrieved District 1 crop record successfully (200 OK)');

    console.log(`22. Auditor A attempting to read crop record ${recordV3Id} in District 2 (Kurukshetra)...`);
    const res22 = await request('GET', `/api/crop-records/${recordV3Id}`, null, auditorAToken);
    if (res22.status !== 403) throw new Error(`Test 22 Failed: Expected 403 Forbidden for cross-district auditor read but got ${res22.status}`);
    console.log('   ✓ Cross-district auditor read blocked (403 Forbidden)');

    // ==========================================
    // DATABASE PERSISTENCE VERIFICATION
    // ==========================================
    console.log('24. Verifying database persistence for crop record...');
    const dbRec = await pool.query('SELECT record_id, farm_id, cultivated_area_hectares FROM farm_crop_records WHERE record_id = $1', [recordV1Id]);
    if (dbRec.rows.length === 0 || parseFloat(dbRec.rows[0].cultivated_area_hectares) !== 4.8) {
      throw new Error('Test 24 Failed: Database verification failed for updated crop record');
    }
    console.log('   ✓ Database persistence and field integrity verified');

    console.log('\n========================================================================');
    console.log('ALL 23 SEASONAL CROP RECORD & GEOGRAPHIC AUTHORIZATION TESTS PASSED!');
    console.log('========================================================================\n');

  } finally {
    await pool.query("DELETE FROM farm_crop_records WHERE agricultural_year LIKE '2026-CR-TEST%'");
    await pool.query("DELETE FROM farms WHERE name LIKE '%CR Test Farm%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@cr-test.com'");
    await pool.end();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

runCropRecordTests().catch(err => {
  console.error('Crop Record Test Suite Error:', err);
  process.exit(1);
});
