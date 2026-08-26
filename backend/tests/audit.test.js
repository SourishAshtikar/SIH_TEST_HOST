const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const app = require('../src/app');
const http = require('http');

let server;
let baseUrl;

let auditorAToken;
let auditorBToken;
let vheadAToken;
let vheadBToken;
let govtToken;
let adminToken;

let recordD1Id;
let recordD2Id;
let auditD1Id;
let auditD2Id;
let auditorAId;
let auditorBId;

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

async function runAuditTests() {
  console.log('--- Running Audit Management & District Geographic Authorization Integration Tests ---\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 0. Clean up previous test records
    await pool.query("DELETE FROM audits WHERE notes LIKE '%Test Audit%'");
    await pool.query("DELETE FROM farm_crop_records WHERE agricultural_year = '2026-AUDIT'");
    await pool.query("DELETE FROM farms WHERE name LIKE '%Audit Test Farm%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@audit-test.com'");

    const passHash = await bcrypt.hash('Password123!', 10);

    // Setup Auditor A (District 1: Karnal)
    const audARes = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, district_id) VALUES ('Auditor Karnal', 'auditor.a@audit-test.com', $1, 'AUDITOR', 1) RETURNING id",
      [passHash]
    );
    auditorAId = audARes.rows[0].id;

    // Setup Auditor B (District 2: Kurukshetra)
    const audBRes = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, district_id) VALUES ('Auditor Kurukshetra', 'auditor.b@audit-test.com', $1, 'AUDITOR', 2) RETURNING id",
      [passHash]
    );
    auditorBId = audBRes.rows[0].id;

    // Setup Village Head A (Village 1: Gharaunda in District 1)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, village_id) VALUES ('Head Gharaunda', 'vhead.a@audit-test.com', $1, 'VILLAGE_HEAD', 1)",
      [passHash]
    );

    // Setup Village Head B (Village 3: Pehowa in District 2)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, village_id) VALUES ('Head Pehowa', 'vhead.b@audit-test.com', $1, 'VILLAGE_HEAD', 3)",
      [passHash]
    );

    // Setup Govt Employee
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Govt Officer', 'govt@audit-test.com', $1, 'GOVERNMENT_EMPLOYEE')",
      [passHash]
    );

    // Setup Admin
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('System Admin', 'admin@audit-test.com', $1, 'ADMIN')",
      [passHash]
    );

    // Log in all users
    const loginAudA = await request('POST', '/api/auth/login', { email: 'auditor.a@audit-test.com', password: 'Password123!' });
    auditorAToken = loginAudA.body.data.token;

    const loginAudB = await request('POST', '/api/auth/login', { email: 'auditor.b@audit-test.com', password: 'Password123!' });
    auditorBToken = loginAudB.body.data.token;

    const loginVHeadA = await request('POST', '/api/auth/login', { email: 'vhead.a@audit-test.com', password: 'Password123!' });
    vheadAToken = loginVHeadA.body.data.token;

    const loginVHeadB = await request('POST', '/api/auth/login', { email: 'vhead.b@audit-test.com', password: 'Password123!' });
    vheadBToken = loginVHeadB.body.data.token;

    const loginGovt = await request('POST', '/api/auth/login', { email: 'govt@audit-test.com', password: 'Password123!' });
    govtToken = loginGovt.body.data.token;

    const loginAdmin = await request('POST', '/api/auth/login', { email: 'admin@audit-test.com', password: 'Password123!' });
    adminToken = loginAdmin.body.data.token;

    // Create Farm in Village 1 (District 1)
    const farm1Res = await pool.query(
      "INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares) VALUES ('Audit Test Farm D1', 'Kisan D1', 1, 3.0) RETURNING farm_id"
    );
    const farm1Id = farm1Res.rows[0].farm_id;

    // Create Farm in Village 3 (District 2)
    const farm2Res = await pool.query(
      "INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares) VALUES ('Audit Test Farm D2', 'Kisan D2', 3, 4.0) RETURNING farm_id"
    );
    const farm2Id = farm2Res.rows[0].farm_id;

    // Create Seasonal Crop Record for Farm 1 in District 1
    const rec1Res = await pool.query(
      "INSERT INTO farm_crop_records (farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id) VALUES ($1, 1, '2026-AUDIT', 1, 2.5, 1) RETURNING record_id",
      [farm1Id]
    );
    recordD1Id = rec1Res.rows[0].record_id;

    // Create Seasonal Crop Record for Farm 2 in District 2
    const rec2Res = await pool.query(
      "INSERT INTO farm_crop_records (farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id) VALUES ($1, 1, '2026-AUDIT', 2, 3.5, 1) RETURNING record_id",
      [farm2Id]
    );
    recordD2Id = rec2Res.rows[0].record_id;

    // ==========================================
    // AUTHENTICATION TESTS
    // ==========================================
    console.log('1. Testing POST /api/audits without JWT...');
    const res1 = await request('POST', '/api/audits', { record_id: recordD1Id, adoption_status: 'ADOPTED', audit_date: '2026-08-22' });
    if (res1.status !== 401) throw new Error(`Test 1 Failed: Expected 401 Unauthorized but got ${res1.status}`);
    console.log('   ✓ Missing JWT token rejected (401 Unauthorized)');

    console.log('2. Testing POST /api/audits with invalid JWT...');
    const res2 = await request('POST', '/api/audits', { record_id: recordD1Id }, 'invalid.jwt.token');
    if (res2.status !== 401) throw new Error(`Test 2 Failed: Expected 401 Unauthorized but got ${res2.status}`);
    console.log('   ✓ Invalid JWT token rejected (401 Unauthorized)');

    // ==========================================
    // ROLE AUTHORIZATION TESTS
    // ==========================================
    console.log('3. Village Head attempting to create audit...');
    const res3 = await request('POST', '/api/audits', { record_id: recordD1Id, adoption_status: 'ADOPTED', audit_date: '2026-08-22' }, vheadAToken);
    if (res3.status !== 403) throw new Error(`Test 3 Failed: Expected 403 Forbidden for Village Head but got ${res3.status}`);
    console.log('   ✓ Village Head audit creation blocked (403 Forbidden)');

    console.log('4. Government Employee attempting to create audit...');
    const res4 = await request('POST', '/api/audits', { record_id: recordD1Id, adoption_status: 'ADOPTED', audit_date: '2026-08-22' }, govtToken);
    if (res4.status !== 403) throw new Error(`Test 4 Failed: Expected 403 Forbidden for Govt Employee but got ${res4.status}`);
    console.log('   ✓ Government Employee audit creation blocked (403 Forbidden)');

    console.log('5. Admin attempting to create audit...');
    const res5 = await request('POST', '/api/audits', { record_id: recordD1Id, adoption_status: 'ADOPTED', audit_date: '2026-08-22' }, adminToken);
    if (res5.status !== 403) throw new Error(`Test 5 Failed: Expected 403 Forbidden for Admin but got ${res5.status}`);
    console.log('   ✓ Admin audit creation blocked (403 Forbidden)');

    // ==========================================
    // CREATE AUDIT TESTS
    // ==========================================
    console.log('7. Auditor A creating audit for crop record in District 1...');
    const res7 = await request('POST', '/api/audits', {
      record_id: recordD1Id,
      actual_irrigation_method_id: 2, // Drip Irrigation
      adoption_status: 'ADOPTED',
      audit_date: '2026-08-22',
      notes: 'Test Audit Verified drip system in Gharaunda'
    }, auditorAToken);

    if (res7.status !== 201 || !res7.body?.data?.audit?.audit_id) {
      throw new Error(`Test 7 Failed: ${JSON.stringify(res7.body)}`);
    }
    auditD1Id = res7.body.data.audit.audit_id;
    console.log(`   ✓ Audit created successfully in District 1 (Audit ID: ${auditD1Id}) (201 Created)`);

    // Auditor B creates audit in District 2
    const resAudB = await request('POST', '/api/audits', {
      record_id: recordD2Id,
      actual_irrigation_method_id: 3, // Sprinkler
      adoption_status: 'ADOPTED',
      audit_date: '2026-08-22',
      notes: 'Test Audit Verified sprinkler in Pehowa'
    }, auditorBToken);
    auditD2Id = resAudB.body.data.audit.audit_id;

    console.log('8. Auditor A attempting to create audit for crop record in District 2 (Kurukshetra)...');
    const res8 = await request('POST', '/api/audits', {
      record_id: recordD2Id,
      actual_irrigation_method_id: 2,
      adoption_status: 'ADOPTED',
      audit_date: '2026-08-22',
      notes: 'Illegal Cross-District Audit'
    }, auditorAToken);
    if (res8.status !== 403) throw new Error(`Test 8 Failed: Expected 403 Forbidden for cross-district audit but got ${res8.status}`);
    console.log('   ✓ Cross-district audit creation rejected (403 Forbidden)');

    console.log('9. Testing non-existent record_id (ID: 999999)...');
    const res9 = await request('POST', '/api/audits', {
      record_id: 999999,
      adoption_status: 'ADOPTED',
      audit_date: '2026-08-22'
    }, auditorAToken);
    if (res9.status !== 404) throw new Error(`Test 9 Failed: Expected 404 Not Found for missing record_id but got ${res9.status}`);
    console.log('   ✓ Non-existent crop record rejected (404 Not Found)');

    console.log('10. Testing invalid adoption_status...');
    const res10 = await request('POST', '/api/audits', {
      record_id: recordD1Id,
      adoption_status: 'INVALID_STATUS',
      audit_date: '2026-08-22'
    }, auditorAToken);
    if (res10.status !== 400) throw new Error(`Test 10 Failed: Expected 400 Bad Request for invalid adoption_status but got ${res10.status}`);
    console.log('   ✓ Invalid adoption_status rejected (400 Bad Request)');

    console.log('11. Testing invalid irrigation method ID...');
    const res11 = await request('POST', '/api/audits', {
      record_id: recordD1Id,
      actual_irrigation_method_id: 999999,
      adoption_status: 'ADOPTED',
      audit_date: '2026-08-22'
    }, auditorAToken);
    if (res11.status !== 400) throw new Error(`Test 11 Failed: Expected 400 Bad Request for non-existent irrigation method but got ${res11.status}`);
    console.log('   ✓ Invalid irrigation method ID rejected (400 Bad Request)');

    // ==========================================
    // READ AUDIT TESTS & IDOR VERIFICATION
    // ==========================================
    console.log(`12. Auditor A reading Audit ${auditD1Id} in District 1...`);
    const res12 = await request('GET', `/api/audits/${auditD1Id}`, null, auditorAToken);
    if (res12.status !== 200 || res12.body?.data?.audit?.district_name !== 'Karnal') {
      throw new Error(`Test 12 Failed: ${JSON.stringify(res12.body)}`);
    }
    console.log('   ✓ Auditor A retrieved District 1 audit successfully (200 OK)');

    console.log(`13. Auditor A attempting to read Audit ${auditD2Id} in District 2 (IDOR Security Test)...`);
    const res13 = await request('GET', `/api/audits/${auditD2Id}`, null, auditorAToken);
    if (res13.status !== 403) throw new Error(`Test 13 Failed: Expected 403 Forbidden for cross-district IDOR read but got ${res13.status}`);
    console.log('   ✓ Auditor A blocked from reading District 2 audit (403 Forbidden - IDOR Protected)');

    console.log(`14. Village Head A reading Audit ${auditD1Id} for their own village's farm...`);
    const res14 = await request('GET', `/api/audits/${auditD1Id}`, null, vheadAToken);
    if (res14.status !== 200 || res14.body?.data?.audit?.village_name !== 'Gharaunda') {
      throw new Error(`Test 14 Failed: ${JSON.stringify(res14.body)}`);
    }
    console.log('   ✓ Village Head A retrieved own village audit successfully (200 OK)');

    console.log(`15. Village Head A attempting to read Audit ${auditD2Id} in another village/district...`);
    const res15 = await request('GET', `/api/audits/${auditD2Id}`, null, vheadAToken);
    if (res15.status !== 403) throw new Error(`Test 15 Failed: Expected 403 Forbidden for cross-village audit read but got ${res15.status}`);
    console.log('   ✓ Village Head A blocked from reading other village audit (403 Forbidden)');

    // ==========================================
    // UPDATE AUDIT TESTS
    // ==========================================
    console.log(`16. Auditor A updating Audit ${auditD1Id} in District 1...`);
    const res16 = await request('PUT', `/api/audits/${auditD1Id}`, {
      actual_irrigation_method_id: 2,
      adoption_status: 'ADOPTED',
      audit_date: '2026-08-23',
      notes: 'Test Audit Updated field notes'
    }, auditorAToken);
    if (res16.status !== 200 || res16.body?.data?.audit?.notes !== 'Test Audit Updated field notes') {
      throw new Error(`Test 16 Failed: ${JSON.stringify(res16.body)}`);
    }
    console.log('   ✓ Audit updated successfully in District 1 (200 OK)');

    console.log(`17. Auditor A attempting to update Audit ${auditD2Id} in District 2...`);
    const res17 = await request('PUT', `/api/audits/${auditD2Id}`, {
      adoption_status: 'NOT_ADOPTED'
    }, auditorAToken);
    if (res17.status !== 403) throw new Error(`Test 17 Failed: Expected 403 Forbidden for cross-district update but got ${res17.status}`);
    console.log('   ✓ Cross-district audit modification rejected (403 Forbidden)');

    console.log(`18. Village Head A attempting to update Audit ${auditD1Id} in their own village...`);
    const res18 = await request('PUT', `/api/audits/${auditD1Id}`, {
      notes: 'Village Head trying to tamper with notes'
    }, vheadAToken);
    if (res18.status !== 403) throw new Error(`Test 18 Failed: Expected 403 Forbidden for Village Head update but got ${res18.status}`);
    console.log('   ✓ Village Head write access to audit blocked (403 Forbidden)');

    console.log('19. Attempting to tamper with auditor_id during PUT update...');
    const res19 = await request('PUT', `/api/audits/${auditD1Id}`, {
      auditor_id: 9999,
      notes: 'Test Audit Tamper attempt'
    }, auditorAToken);
    const dbAuditCheck = await pool.query('SELECT auditor_id FROM audits WHERE audit_id = $1', [auditD1Id]);
    if (dbAuditCheck.rows[0].auditor_id !== auditorAId) {
      throw new Error('Test 19 Failed: auditor_id was illegally modified in database!');
    }
    console.log('   ✓ Auditor ID immutability verified (auditor_id remains unchanged in DB)');

    // ==========================================
    // DATABASE INTEGRITY VERIFICATIONS
    // ==========================================
    console.log('20. Verifying persisted audit record in PostgreSQL...');
    const dbAudit = await pool.query(
      'SELECT a.audit_id, a.record_id, a.auditor_id, a.actual_irrigation_method_id, a.adoption_status, a.notes FROM audits a WHERE a.audit_id = $1',
      [auditD1Id]
    );
    if (dbAudit.rows.length === 0 || dbAudit.rows[0].auditor_id !== auditorAId || dbAudit.rows[0].record_id !== recordD1Id) {
      throw new Error('Test 20 Failed: Database verification failed for persisted audit');
    }
    console.log('   ✓ Database record integrity verified: correct auditor_id, record_id, and adoption_status');

    console.log('\n===============================================================');
    console.log('ALL 20 AUDIT MANAGEMENT & DISTRICT AUTHORIZATION TESTS PASSED!');
    console.log('===============================================================\n');

  } finally {
    await pool.query("DELETE FROM audits WHERE notes LIKE '%Test Audit%'");
    await pool.query("DELETE FROM farm_crop_records WHERE agricultural_year = '2026-AUDIT'");
    await pool.query("DELETE FROM farms WHERE name LIKE '%Audit Test Farm%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@audit-test.com'");
    await pool.end();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

runAuditTests().catch(err => {
  console.error('Audit Test Suite Error:', err);
  process.exit(1);
});
