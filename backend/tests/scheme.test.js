const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const app = require('../src/app');
const http = require('http');

let server;
let baseUrl;

let adminToken;
let vheadToken;
let auditorToken;
let govtToken;

let createdSchemeId;

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

async function runSchemeTests() {
  console.log('--- Running Government Scheme API & Role Authorization Integration Tests ---\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 0. Clean up previous test records
    await pool.query("DELETE FROM schemes WHERE name LIKE '%Test Scheme%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@scheme-test.com'");

    const passHash = await bcrypt.hash('Password123!', 10);

    // Setup Admin
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin User', 'admin@scheme-test.com', $1, 'ADMIN')",
      [passHash]
    );

    // Setup Village Head
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, village_id) VALUES ('Village Head', 'vhead@scheme-test.com', $1, 'VILLAGE_HEAD', 1)",
      [passHash]
    );

    // Setup Auditor
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, district_id) VALUES ('Auditor', 'auditor@scheme-test.com', $1, 'AUDITOR', 1)",
      [passHash]
    );

    // Setup Govt Employee
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Govt Official', 'govt@scheme-test.com', $1, 'GOVERNMENT_EMPLOYEE')",
      [passHash]
    );

    // Log in all users
    const loginAdmin = await request('POST', '/api/auth/login', { email: 'admin@scheme-test.com', password: 'Password123!' });
    adminToken = loginAdmin.body.data.token;

    const loginVH = await request('POST', '/api/auth/login', { email: 'vhead@scheme-test.com', password: 'Password123!' });
    vheadToken = loginVH.body.data.token;

    const loginAud = await request('POST', '/api/auth/login', { email: 'auditor@scheme-test.com', password: 'Password123!' });
    auditorToken = loginAud.body.data.token;

    const loginGovt = await request('POST', '/api/auth/login', { email: 'govt@scheme-test.com', password: 'Password123!' });
    govtToken = loginGovt.body.data.token;

    // ==========================================
    // AUTHENTICATION TESTS
    // ==========================================
    console.log('19. Testing unauthenticated request to /api/schemes...');
    const resUnauth = await request('GET', '/api/schemes');
    if (resUnauth.status !== 401) throw new Error(`Test 19 Failed: Expected 401 Unauthorized but got ${resUnauth.status}`);
    console.log('    ✓ Unauthenticated request rejected (401 Unauthorized)');

    // ==========================================
    // NON-ADMIN WRITE RESTRICTION TESTS (POST)
    // ==========================================
    console.log('10. Testing VILLAGE_HEAD cannot create scheme...');
    const res10 = await request('POST', '/api/schemes', { name: 'VH Test Scheme', description: 'desc' }, vheadToken);
    if (res10.status !== 403) throw new Error(`Test 10 Failed: Expected 403 Forbidden for Village Head but got ${res10.status}`);
    console.log('    ✓ Village Head scheme creation blocked (403 Forbidden)');

    console.log('11. Testing AUDITOR cannot create scheme...');
    const res11 = await request('POST', '/api/schemes', { name: 'Auditor Test Scheme', description: 'desc' }, auditorToken);
    if (res11.status !== 403) throw new Error(`Test 11 Failed: Expected 403 Forbidden for Auditor but got ${res11.status}`);
    console.log('    ✓ Auditor scheme creation blocked (403 Forbidden)');

    console.log('12. Testing GOVERNMENT_EMPLOYEE cannot create scheme...');
    const res12 = await request('POST', '/api/schemes', { name: 'Govt Test Scheme', description: 'desc' }, govtToken);
    if (res12.status !== 403) throw new Error(`Test 12 Failed: Expected 403 Forbidden for Govt Employee but got ${res12.status}`);
    console.log('    ✓ Govt Employee scheme creation blocked (403 Forbidden)');

    // ==========================================
    // ADMIN WRITE & VALIDATION TESTS (POST)
    // ==========================================
    console.log('7. Testing ADMIN validation on invalid scheme (missing name/description/bad URL)...');
    const res7a = await request('POST', '/api/schemes', { description: 'Missing name' }, adminToken);
    if (res7a.status !== 400) throw new Error(`Test 7a Failed: Expected 400 Bad Request for missing name, got ${res7a.status}`);

    const res7b = await request('POST', '/api/schemes', { name: 'Test Scheme', external_link: 'invalid-link' }, adminToken);
    if (res7b.status !== 400) throw new Error(`Test 7b Failed: Expected 400 Bad Request for bad URL, got ${res7b.status}`);
    console.log('   ✓ Invalid scheme creation payloads rejected (400 Bad Request)');

    console.log('4. ADMIN creating valid government scheme...');
    const res4 = await request('POST', '/api/schemes', {
      name: 'Haryana Micro-Irrigation Test Scheme',
      description: 'Provides financial subsidies up to 85% for drip and sprinkler systems.',
      government_level: 'STATE',
      benefit_description: '85% subsidy on equipment.',
      eligibility: 'Farmers in Haryana with verified agricultural land.',
      application_information: 'Apply through Haryana Agri Portal.',
      external_link: 'https://agriharyana.gov.in'
    }, adminToken);
    if (res4.status !== 201 || !res4.body?.data?.scheme?.scheme_id) {
      throw new Error(`Test 4 Failed: ${JSON.stringify(res4.body)}`);
    }
    createdSchemeId = res4.body.data.scheme.scheme_id;
    console.log(`   ✓ Scheme created successfully by ADMIN (ID: ${createdSchemeId}) (201 Created)`);

    // ==========================================
    // READ SCHEME TESTS (GET)
    // ==========================================
    console.log('1. Authenticated user (VILLAGE_HEAD) reading scheme catalog (GET /api/schemes)...');
    const res1 = await request('GET', '/api/schemes', null, vheadToken);
    if (res1.status !== 200 || !Array.isArray(res1.body?.data?.schemes)) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(res1.body)}`);
    }
    console.log(`   ✓ Schemes catalog retrieved successfully (${res1.body.data.schemes.length} schemes returned) (200 OK)`);

    console.log(`2. Authenticated user (AUDITOR) reading single scheme (ID: ${createdSchemeId})...`);
    const res2 = await request('GET', `/api/schemes/${createdSchemeId}`, null, auditorToken);
    if (res2.status !== 200 || res2.body?.data?.scheme?.scheme_id !== createdSchemeId) {
      throw new Error(`Test 2 Failed: ${JSON.stringify(res2.body)}`);
    }
    console.log('   ✓ Single scheme retrieved successfully by authenticated user (200 OK)');

    console.log('3. Testing nonexistent scheme lookup (ID: 999999)...');
    const res3 = await request('GET', '/api/schemes/999999', null, vheadToken);
    if (res3.status !== 404) throw new Error(`Test 3 Failed: Expected 404 Not Found but got ${res3.status}`);
    console.log('   ✓ Nonexistent scheme returned 404 Not Found');

    // ==========================================
    // NON-ADMIN UPDATE & DELETE RESTRICTIONS
    // ==========================================
    console.log(`13. Testing VILLAGE_HEAD cannot update scheme (ID: ${createdSchemeId})...`);
    const res13 = await request('PUT', `/api/schemes/${createdSchemeId}`, { name: 'Hacked' }, vheadToken);
    if (res13.status !== 403) throw new Error(`Test 13 Failed: Expected 403 Forbidden, got ${res13.status}`);
    console.log('    ✓ Village Head scheme update blocked (403 Forbidden)');

    console.log(`14. Testing AUDITOR cannot update scheme (ID: ${createdSchemeId})...`);
    const res14 = await request('PUT', `/api/schemes/${createdSchemeId}`, { name: 'Hacked' }, auditorToken);
    if (res14.status !== 403) throw new Error(`Test 14 Failed: Expected 403 Forbidden, got ${res14.status}`);
    console.log('    ✓ Auditor scheme update blocked (403 Forbidden)');

    console.log(`15. Testing GOVERNMENT_EMPLOYEE cannot update scheme (ID: ${createdSchemeId})...`);
    const res15 = await request('PUT', `/api/schemes/${createdSchemeId}`, { name: 'Hacked' }, govtToken);
    if (res15.status !== 403) throw new Error(`Test 15 Failed: Expected 403 Forbidden, got ${res15.status}`);
    console.log('    ✓ Govt Employee scheme update blocked (403 Forbidden)');

    console.log(`16. Testing VILLAGE_HEAD cannot delete scheme (ID: ${createdSchemeId})...`);
    const res16 = await request('DELETE', `/api/schemes/${createdSchemeId}`, null, vheadToken);
    if (res16.status !== 403) throw new Error(`Test 16 Failed: Expected 403 Forbidden, got ${res16.status}`);
    console.log('    ✓ Village Head scheme deletion blocked (403 Forbidden)');

    console.log(`17. Testing AUDITOR cannot delete scheme (ID: ${createdSchemeId})...`);
    const res17 = await request('DELETE', `/api/schemes/${createdSchemeId}`, null, auditorToken);
    if (res17.status !== 403) throw new Error(`Test 17 Failed: Expected 403 Forbidden, got ${res17.status}`);
    console.log('    ✓ Auditor scheme deletion blocked (403 Forbidden)');

    console.log(`18. Testing GOVERNMENT_EMPLOYEE cannot delete scheme (ID: ${createdSchemeId})...`);
    const res18 = await request('DELETE', `/api/schemes/${createdSchemeId}`, null, govtToken);
    if (res18.status !== 403) throw new Error(`Test 18 Failed: Expected 403 Forbidden, got ${res18.status}`);
    console.log('    ✓ Govt Employee scheme deletion blocked (403 Forbidden)');

    // ==========================================
    // ADMIN UPDATE TESTS
    // ==========================================
    console.log('8. Testing ADMIN cannot update nonexistent scheme (ID: 999999)...');
    const res8 = await request('PUT', '/api/schemes/999999', { name: 'Ghost' }, adminToken);
    if (res8.status !== 404) throw new Error(`Test 8 Failed: Expected 404 Not Found, got ${res8.status}`);
    console.log('   ✓ Nonexistent scheme update rejected (404 Not Found)');

    console.log(`5. ADMIN updating scheme (ID: ${createdSchemeId})...`);
    const res5 = await request('PUT', `/api/schemes/${createdSchemeId}`, {
      name: 'Haryana Micro-Irrigation Test Scheme (Updated)',
      benefit_description: 'Updated 90% subsidy.'
    }, adminToken);
    if (res5.status !== 200 || res5.body?.data?.scheme?.name !== 'Haryana Micro-Irrigation Test Scheme (Updated)') {
      throw new Error(`Test 5 Failed: ${JSON.stringify(res5.body)}`);
    }
    console.log('   ✓ Scheme updated successfully by ADMIN (200 OK)');

    // ==========================================
    // DATABASE PERSISTENCE VERIFICATION
    // ==========================================
    console.log('20 & 21. Verifying persisted updated scheme in PostgreSQL...');
    const dbCheck = await pool.query('SELECT scheme_id, name, benefit_description FROM schemes WHERE scheme_id = $1', [createdSchemeId]);
    if (dbCheck.rows.length === 0 || dbCheck.rows[0].benefit_description !== 'Updated 90% subsidy.') {
      throw new Error('Test 20/21 Failed: Database persistence verification failed');
    }
    console.log('   ✓ Database persistence verified');

    // ==========================================
    // ADMIN DELETE TESTS
    // ==========================================
    console.log('9. Testing ADMIN cannot delete nonexistent scheme (ID: 999999)...');
    const res9 = await request('DELETE', '/api/schemes/999999', null, adminToken);
    if (res9.status !== 404) throw new Error(`Test 9 Failed: Expected 404 Not Found, got ${res9.status}`);
    console.log('   ✓ Nonexistent scheme delete returned 404 Not Found');

    console.log(`6. ADMIN deleting scheme (ID: ${createdSchemeId})...`);
    const res6 = await request('DELETE', `/api/schemes/${createdSchemeId}`, null, adminToken);
    if (res6.status !== 200) throw new Error(`Test 6 Failed: ${JSON.stringify(res6.body)}`);
    console.log('   ✓ Scheme deleted successfully by ADMIN (200 OK)');

    console.log('22. Verifying scheme is removed from PostgreSQL...');
    const dbDeletedCheck = await pool.query('SELECT scheme_id FROM schemes WHERE scheme_id = $1', [createdSchemeId]);
    if (dbDeletedCheck.rows.length > 0) {
      throw new Error('Test 22 Failed: Scheme still exists in database after deletion');
    }
    console.log('   ✓ Database removal verified');

    console.log('\n========================================================================');
    console.log('ALL 22 GOVERNMENT SCHEME API & ROLE AUTHORIZATION TESTS PASSED!');
    console.log('========================================================================\n');

  } finally {
    await pool.query("DELETE FROM schemes WHERE name LIKE '%Test Scheme%'");
    await pool.query("DELETE FROM users WHERE email LIKE '%@scheme-test.com'");
    await pool.end();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

runSchemeTests().catch(err => {
  console.error('Scheme Test Suite Error:', err);
  process.exit(1);
});
