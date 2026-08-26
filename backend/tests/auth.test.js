const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const app = require('../src/app');
const http = require('http');

let server;
let baseUrl;

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

    const req = http.request(url, {
      method,
      headers
    }, (res) => {
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

async function runTests() {
  console.log('--- Running Complete Authentication & Authorization Security Tests ---\n');

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  await pool.query("DELETE FROM sustainability_scores");
  await pool.query("DELETE FROM audits WHERE auditor_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");

  let adminToken = null;
  let villageHeadToken = null;

  try {
    // 1. Register VILLAGE_HEAD -> success (201)
    console.log('1. Registering VILLAGE_HEAD...');
    const res1 = await request('POST', '/api/auth/register', {
      name: 'Ramesh Patel',
      email: 'ramesh.head@test.com',
      password: 'Password123!',
      role: 'VILLAGE_HEAD'
    });
    if (res1.status !== 201 || res1.body?.data?.user?.role !== 'VILLAGE_HEAD') {
      throw new Error(`Test 1 Failed: Expected 201 but got ${res1.status} - ${JSON.stringify(res1.body)}`);
    }
    console.log('   ✓ VILLAGE_HEAD registered successfully (201 Created)');

    // 2. Register AUDITOR -> success (201)
    console.log('2. Registering AUDITOR...');
    const res2 = await request('POST', '/api/auth/register', {
      name: 'Priya Sharma',
      email: 'priya.auditor@test.com',
      password: 'Password123!',
      role: 'AUDITOR'
    });
    if (res2.status !== 201 || res2.body?.data?.user?.role !== 'AUDITOR') {
      throw new Error(`Test 2 Failed: Expected 201 but got ${res2.status} - ${JSON.stringify(res2.body)}`);
    }
    console.log('   ✓ AUDITOR registered successfully (201 Created)');

    // 3. Register GOVERNMENT_EMPLOYEE -> success (201)
    console.log('3. Registering GOVERNMENT_EMPLOYEE...');
    const res3 = await request('POST', '/api/auth/register', {
      name: 'Anil Kumar',
      email: 'anil.govt@test.com',
      password: 'Password123!',
      role: 'GOVERNMENT_EMPLOYEE'
    });
    if (res3.status !== 201 || res3.body?.data?.user?.role !== 'GOVERNMENT_EMPLOYEE') {
      throw new Error(`Test 3 Failed: Expected 201 but got ${res3.status} - ${JSON.stringify(res3.body)}`);
    }
    console.log('   ✓ GOVERNMENT_EMPLOYEE registered successfully (201 Created)');

    // 4. Attempt to register ADMIN -> rejected (403 Forbidden)
    console.log('4. Attempting public registration with ADMIN role...');
    const res4 = await request('POST', '/api/auth/register', {
      name: 'Rogue Admin',
      email: 'rogue.admin@test.com',
      password: 'Password123!',
      role: 'ADMIN'
    });
    if (res4.status !== 403) {
      throw new Error(`Test 4 Failed: Expected 403 Forbidden for ADMIN registration but got ${res4.status}`);
    }
    console.log('   ✓ ADMIN self-registration correctly rejected (403 Forbidden)');

    // 5. Attempt to register with an invalid role -> rejected (400 Bad Request)
    console.log('5. Attempting registration with invalid role (FARMER)...');
    const res5 = await request('POST', '/api/auth/register', {
      name: 'Farmer User',
      email: 'farmer@test.com',
      password: 'Password123!',
      role: 'FARMER'
    });
    if (res5.status !== 400) {
      throw new Error(`Test 5 Failed: Expected 400 Bad Request for invalid role but got ${res5.status}`);
    }
    console.log('   ✓ Invalid role correctly rejected (400 Bad Request)');

    // 6. Attempt to register duplicate email -> rejected (409 Conflict)
    console.log('6. Attempting duplicate email registration...');
    const res6 = await request('POST', '/api/auth/register', {
      name: 'Duplicate Ramesh',
      email: 'ramesh.head@test.com',
      password: 'AnotherPassword123!',
      role: 'VILLAGE_HEAD'
    });
    if (res6.status !== 409) {
      throw new Error(`Test 6 Failed: Expected 409 Conflict for duplicate email but got ${res6.status}`);
    }
    console.log('   ✓ Duplicate email correctly rejected (409 Conflict)');

    // 7. Attempt to provide district_id during public registration -> must not result in self-assignment
    console.log('7. Attempting to self-assign district_id during public registration...');
    const res7 = await request('POST', '/api/auth/register', {
      name: 'District Self Assign Test',
      email: 'self.district@test.com',
      password: 'Password123!',
      role: 'AUDITOR',
      district_id: 1
    });
    if (res7.status !== 201) {
      throw new Error(`Test 7 Failed: Registration failed with status ${res7.status}`);
    }
    const checkDbDistrict = await pool.query('SELECT district_id, village_id FROM users WHERE email = $1', ['self.district@test.com']);
    if (checkDbDistrict.rows[0].district_id !== null) {
      throw new Error('Test 7 Failed: district_id was illegally self-assigned in database!');
    }
    console.log('   ✓ district_id self-assignment prevented (district_id is NULL in DB)');

    // 8. Attempt to provide village_id during public registration -> must not result in self-assignment
    console.log('8. Attempting to self-assign village_id during public registration...');
    const res8 = await request('POST', '/api/auth/register', {
      name: 'Village Self Assign Test',
      email: 'self.village@test.com',
      password: 'Password123!',
      role: 'VILLAGE_HEAD',
      village_id: 1
    });
    if (res8.status !== 201) {
      throw new Error(`Test 8 Failed: Registration failed with status ${res8.status}`);
    }
    const checkDbVillage = await pool.query('SELECT district_id, village_id FROM users WHERE email = $1', ['self.village@test.com']);
    if (checkDbVillage.rows[0].village_id !== null) {
      throw new Error('Test 8 Failed: village_id was illegally self-assigned in database!');
    }
    console.log('   ✓ village_id self-assignment prevented (village_id is NULL in DB)');

    // Setup Admin user directly in DB (simulating system/admin initialization)
    const adminPassHash = await bcrypt.hash('AdminPassword123!', 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('System Admin', 'system.admin@test.com', $1, 'ADMIN')",
      [adminPassHash]
    );

    // 9. Valid login -> success (200)
    console.log('9. Logging in with valid credentials...');
    const resLoginAdmin = await request('POST', '/api/auth/login', {
      email: 'system.admin@test.com',
      password: 'AdminPassword123!'
    });
    if (resLoginAdmin.status !== 200 || !resLoginAdmin.body?.data?.token) {
      throw new Error(`Test 9 Admin Login Failed: ${JSON.stringify(resLoginAdmin.body)}`);
    }
    adminToken = resLoginAdmin.body.data.token;

    const resLoginVH = await request('POST', '/api/auth/login', {
      email: 'ramesh.head@test.com',
      password: 'Password123!'
    });
    if (resLoginVH.status !== 200 || !resLoginVH.body?.data?.token) {
      throw new Error(`Test 9 Village Head Login Failed: ${JSON.stringify(resLoginVH.body)}`);
    }
    villageHeadToken = resLoginVH.body.data.token;
    console.log('   ✓ Login successful and JWT token returned (200 OK)');

    // 10. Invalid password -> 401
    console.log('10. Logging in with invalid password...');
    const res10 = await request('POST', '/api/auth/login', {
      email: 'system.admin@test.com',
      password: 'WrongPassword999!'
    });
    if (res10.status !== 401) {
      throw new Error(`Test 10 Failed: Expected 401 Unauthorized but got ${res10.status}`);
    }
    console.log('   ✓ Invalid password rejected (401 Unauthorized)');

    // 11. /api/auth/me without token -> 401
    console.log('11. Accessing /api/auth/me without token...');
    const res11 = await request('GET', '/api/auth/me');
    if (res11.status !== 401) {
      throw new Error(`Test 11 Failed: Expected 401 Unauthorized but got ${res11.status}`);
    }
    console.log('   ✓ Missing token rejected (401 Unauthorized)');

    // 12. /api/auth/me with valid token -> 200
    console.log('12. Accessing /api/auth/me with valid token...');
    const res12 = await request('GET', '/api/auth/me', null, villageHeadToken);
    if (res12.status !== 200 || res12.body?.data?.user?.email !== 'ramesh.head@test.com') {
      throw new Error(`Test 12 Failed: Expected 200 OK with user details but got ${res12.status}`);
    }
    if (JSON.stringify(res12.body).includes('password_hash') || JSON.stringify(res12.body).includes('Password123')) {
      throw new Error('Test 12 Failed: Password or hash leaked in /api/auth/me!');
    }
    console.log('   ✓ Profile retrieved successfully without password exposure (200 OK)');

    // 13. Admin endpoint with ADMIN token -> 200
    console.log('13. Accessing /api/auth/admin-test with ADMIN token...');
    const res13 = await request('GET', '/api/auth/admin-test', null, adminToken);
    if (res13.status !== 200) {
      throw new Error(`Test 13 Failed: Expected 200 OK for admin but got ${res13.status}`);
    }
    console.log('   ✓ ADMIN authorized to access admin test route (200 OK)');

    // 14. Admin endpoint with non-ADMIN token -> 403
    console.log('14. Accessing /api/auth/admin-test with non-ADMIN token...');
    const res14 = await request('GET', '/api/auth/admin-test', null, villageHeadToken);
    if (res14.status !== 403) {
      throw new Error(`Test 14 Failed: Expected 403 Forbidden for non-admin but got ${res14.status}`);
    }
    console.log('   ✓ Non-admin correctly forbidden from admin route (403 Forbidden)');

    console.log('\n===============================================================');
    console.log('ALL 14 AUTHENTICATION & SECURITY INTEGRATION TESTS PASSED!');
    console.log('===============================================================\n');

  } finally {
    await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");
    await pool.end();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

runTests().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
