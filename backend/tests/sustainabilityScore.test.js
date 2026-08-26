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
let adminToken;

let farmAId, farmBId, farmCId, farmDId, farmEId, farmFId, farmGId;
let village1Id, village2Id;

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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`   ✓ ${message}`);
}

async function setupTestData() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Clean tables
  await pool.query('DELETE FROM sustainability_scores');
  await pool.query('DELETE FROM audits');
  await pool.query('DELETE FROM farm_crop_records');
  await pool.query('DELETE FROM farms');

  // Districts
  await pool.query(`
    INSERT INTO districts (name, state_id) VALUES
      ('Normalized Dist Karnal', 1),
      ('Normalized Dist Kurukshetra', 1)
    ON CONFLICT (name, state_id) DO NOTHING;
  `);

  const d1Res = await pool.query("SELECT district_id FROM districts WHERE name = 'Normalized Dist Karnal'");
  const d2Res = await pool.query("SELECT district_id FROM districts WHERE name = 'Normalized Dist Kurukshetra'");
  const dist1Id = d1Res.rows[0].district_id;
  const dist2Id = d2Res.rows[0].district_id;

  // Villages
  await pool.query(`
    INSERT INTO villages (name, district_id, lgd_code, tehsil, block, station_name, latitude, longitude) VALUES
      ('Normalized Vil Gharaunda', ${dist1Id}, '0618001', 'Gharaunda', 'GHARAUNDA', 'Gharaunda', 29.5372, 76.9722),
      ('Normalized Vil Pehowa', ${dist2Id}, '0618002', 'Pehowa', 'PEHOWA', 'Pehowa', 29.9806, 76.5828)
    ON CONFLICT (name, district_id) DO NOTHING;
  `);

  const v1Res = await pool.query("SELECT village_id FROM villages WHERE name = 'Normalized Vil Gharaunda'");
  const v2Res = await pool.query("SELECT village_id FROM villages WHERE name = 'Normalized Vil Pehowa'");
  village1Id = v1Res.rows[0].village_id;
  village2Id = v2Res.rows[0].village_id;

  // Users
  const userEmails = [
    { email: 'norm_vhead_a@test.com', role: 'VILLAGE_HEAD', vId: village1Id, dId: dist1Id },
    { email: 'norm_vhead_b@test.com', role: 'VILLAGE_HEAD', vId: village2Id, dId: dist2Id },
    { email: 'norm_auditor_a@test.com', role: 'AUDITOR', vId: null, dId: dist1Id },
    { email: 'norm_auditor_b@test.com', role: 'AUDITOR', vId: null, dId: dist2Id },
    { email: 'norm_admin@test.com', role: 'ADMIN', vId: null, dId: null }
  ];

  for (const u of userEmails) {
    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, village_id, district_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, village_id = EXCLUDED.village_id, district_id = EXCLUDED.district_id
    `, [u.email, u.email, passwordHash, u.role, u.vId, u.dId]);
  }

  const aud1Res = await pool.query("SELECT id FROM users WHERE email = 'norm_auditor_a@test.com'");
  const auditor1Id = aud1Res.rows[0].id;

  // Agricultural base
  await pool.query(`
    INSERT INTO seasons (season_id, name) VALUES (1, 'Kharif'), (2, 'Rabi') ON CONFLICT (name) DO NOTHING;
    INSERT INTO crops (crop_id, name, water_requirement) VALUES (1, 'Rice', 'High'), (2, 'Wheat', 'Medium') ON CONFLICT (name) DO NOTHING;
    INSERT INTO irrigation_methods (method_id, name) VALUES (1, 'Flood Irrigation'), (2, 'Drip Irrigation'), (3, 'Sprinkler Irrigation') ON CONFLICT (name) DO NOTHING;
  `);

  // Helper to create farm, records, audits
  async function createFarm(name, owner, villageId) {
    const r = await pool.query('INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares) VALUES ($1, $2, $3, 3.0) RETURNING farm_id', [name, owner, villageId]);
    return r.rows[0].farm_id;
  }

  async function addRecord(farmId, seasonId, year, cropId, methodId) {
    const r = await pool.query(`
      INSERT INTO farm_crop_records (farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id)
      VALUES ($1, $2, $3, $4, 2.5, $5)
      RETURNING record_id
    `, [farmId, seasonId, year, cropId, methodId]);
    return r.rows[0].record_id;
  }

  async function addAudit(recordId, auditorId, methodId, status) {
    const r = await pool.query(`
      INSERT INTO audits (record_id, auditor_id, actual_irrigation_method_id, adoption_status, audit_date, notes)
      VALUES ($1, $2, $3, $4, '2026-08-20', 'Verified by test')
      RETURNING audit_id
    `, [recordId, auditorId, methodId, status]);
    return r.rows[0].audit_id;
  }

  // --- Setup Scenario A: Perfect Adopter (Farm A) ---
  // History: 2025 Kharif (ADOPTED), 2025 Rabi (ADOPTED). Current: 2026 Kharif (Drip, Audited ADOPTED)
  farmAId = await createFarm('Farm A Perfect', 'Baldev Singh', village1Id);
  const rA1 = await addRecord(farmAId, 1, '2025', 1, 2);
  await addAudit(rA1, auditor1Id, 2, 'ADOPTED');
  const rA2 = await addRecord(farmAId, 2, '2025', 2, 2);
  await addAudit(rA2, auditor1Id, 2, 'ADOPTED');
  const rA3 = await addRecord(farmAId, 1, '2026', 1, 2);
  await addAudit(rA3, auditor1Id, 2, 'ADOPTED');

  // --- Setup Scenario B: First-Time Verified Adopter (Farm B) ---
  // No previous history. Current: 2026 Kharif (Sprinkler, Audited ADOPTED)
  farmBId = await createFarm('Farm B FirstTime', 'Kisan New', village1Id);
  const rB1 = await addRecord(farmBId, 1, '2026', 1, 3);
  await addAudit(rB1, auditor1Id, 3, 'ADOPTED');

  // --- Setup Scenario C: Improving Farm (Farm C) ---
  // History: 2025 Kharif (NOT_ADOPTED), 2025 Rabi (ADOPTED). Current: 2026 Kharif (ADOPTED)
  farmCId = await createFarm('Farm C Improving', 'Sukhwinder', village1Id);
  const rC1 = await addRecord(farmCId, 1, '2025', 1, 1);
  await addAudit(rC1, auditor1Id, 1, 'NOT_ADOPTED');
  const rC2 = await addRecord(farmCId, 2, '2025', 2, 3);
  await addAudit(rC2, auditor1Id, 3, 'ADOPTED');
  const rC3 = await addRecord(farmCId, 1, '2026', 1, 3);
  await addAudit(rC3, auditor1Id, 3, 'ADOPTED');

  // --- Setup Scenario D: Current Relapse (Farm D) ---
  // History: 2025 Kharif (ADOPTED), 2025 Rabi (ADOPTED). Current: 2026 Kharif (NOT_ADOPTED)
  farmDId = await createFarm('Farm D Relapse', 'Kuldeep', village1Id);
  const rD1 = await addRecord(farmDId, 1, '2025', 1, 2);
  await addAudit(rD1, auditor1Id, 2, 'ADOPTED');
  const rD2 = await addRecord(farmDId, 2, '2025', 2, 2);
  await addAudit(rD2, auditor1Id, 2, 'ADOPTED');
  const rD3 = await addRecord(farmDId, 1, '2026', 1, 2);
  await addAudit(rD3, auditor1Id, 1, 'NOT_ADOPTED');

  // --- Setup Scenario E: Historical Adopter with Current Flood (Farm E) ---
  // History: 2024 Kharif (ADOPTED), 2024 Rabi (ADOPTED), 2025 Kharif (ADOPTED), 2025 Rabi (NOT_ADOPTED). Current: 2026 Kharif (NOT_ADOPTED)
  farmEId = await createFarm('Farm E Reverted', 'Rajesh', village1Id);
  const rE1 = await addRecord(farmEId, 1, '2024', 1, 2);
  await addAudit(rE1, auditor1Id, 2, 'ADOPTED');
  const rE2 = await addRecord(farmEId, 2, '2024', 2, 2);
  await addAudit(rE2, auditor1Id, 2, 'ADOPTED');
  const rE3 = await addRecord(farmEId, 1, '2025', 1, 2);
  await addAudit(rE3, auditor1Id, 2, 'ADOPTED');
  const rE4 = await addRecord(farmEId, 2, '2025', 2, 1);
  await addAudit(rE4, auditor1Id, 1, 'NOT_ADOPTED');
  const rE5 = await addRecord(farmEId, 1, '2026', 1, 1);
  await addAudit(rE5, auditor1Id, 1, 'NOT_ADOPTED');

  // --- Setup Scenario F: Not Yet Audited (Farm F) ---
  farmFId = await createFarm('Farm F Unaudited', 'Amit', village1Id);
  await addRecord(farmFId, 1, '2026', 1, 2);

  // --- Setup Scenario G: Conventional Flood Farm (Farm G) ---
  farmGId = await createFarm('Farm G Flood', 'Navdeep', village1Id);
  const rG1 = await addRecord(farmGId, 1, '2026', 1, 1);
  await addAudit(rG1, auditor1Id, 1, 'NOT_ADOPTED');

  // Login tokens
  const login = async (email) => {
    const res = await request('POST', '/api/auth/login', { email, password: 'password123' });
    return res.body?.data?.token;
  };

  vheadAToken = await login('norm_vhead_a@test.com');
  vheadBToken = await login('norm_vhead_b@test.com');
  auditorAToken = await login('norm_auditor_a@test.com');
  auditorBToken = await login('norm_auditor_b@test.com');
  adminToken = await login('norm_admin@test.com');
}

async function runTests() {
  console.log('\n--- Running Normalized (50/30/20) Sustainability Score & Priority Tests ---\n');

  // 1. SCENARIO A: Perfect Adopter (50 + 30 + 20 = 100 -> HIGH)
  console.log('1. Testing Scenario A (Perfect Adopter: 100 / 100 HIGH)...');
  const resA = await request('POST', `/api/farms/${farmAId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(resA.status === 200, 'Scenario A calculated (200 OK)');
  const scA = resA.body.data;
  assert(scA.scores.adoption === 50, 'Scenario A Adoption = 50 / 50');
  assert(scA.scores.continued_adoption === 30, 'Scenario A Continued Adoption = 30 / 30 (3/3 = 100%)');
  assert(scA.scores.audit === 20, 'Scenario A Audit = 20 / 20');
  assert(scA.sustainability_score === 100, 'Scenario A Total Score = 100');
  assert(scA.priority === 'HIGH', 'Scenario A Priority = HIGH (> 75)');

  // 2. SCENARIO B: First-Time Verified Adopter (50 + 30 + 20 = 100 -> HIGH)
  console.log('2. Testing Scenario B (First-Time Verified Adopter: 100 / 100 HIGH)...');
  const resB = await request('POST', `/api/farms/${farmBId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(resB.status === 200, 'Scenario B calculated (200 OK)');
  const scB = resB.body.data;
  assert(scB.scores.adoption === 50, 'Scenario B Adoption = 50 / 50');
  assert(scB.scores.continued_adoption === 30, 'Scenario B First-Time Baseline Continued Adoption = 30 / 30');
  assert(scB.scores.audit === 20, 'Scenario B Audit = 20 / 20');
  assert(scB.sustainability_score === 100, 'Scenario B Total Score = 100');
  assert(scB.priority === 'HIGH', 'Scenario B Priority = HIGH');

  // 3. SCENARIO C: Improving Farm (50 + 20 + 20 = 90 -> HIGH)
  console.log('3. Testing Scenario C (Improving Farm: 90 / 100 HIGH)...');
  const resC = await request('POST', `/api/farms/${farmCId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(resC.status === 200, 'Scenario C calculated (200 OK)');
  const scC = resC.body.data;
  assert(scC.scores.adoption === 50, 'Scenario C Adoption = 50 / 50');
  assert(scC.scores.continued_adoption === 20, 'Scenario C Continued Adoption = 20 / 30 (round(2/3 * 30) = 20)');
  assert(scC.scores.audit === 20, 'Scenario C Audit = 20 / 20');
  assert(scC.sustainability_score === 90, 'Scenario C Total Score = 90');
  assert(scC.priority === 'HIGH', 'Scenario C Priority = HIGH');

  // 4. SCENARIO D: Current Relapse (0 + 20 + 20 = 40 -> LOW)
  console.log('4. Testing Scenario D (Current Relapse: 40 / 100 LOW)...');
  const resD = await request('POST', `/api/farms/${farmDId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(resD.status === 200, 'Scenario D calculated (200 OK)');
  const scD = resD.body.data;
  assert(scD.scores.adoption === 0, 'Scenario D Adoption = 0 (current audit is NOT_ADOPTED)');
  assert(scD.scores.continued_adoption === 20, 'Scenario D Continued Adoption = 20 (2/3 = 20)');
  assert(scD.scores.audit === 20, 'Scenario D Audit = 20 (audit was completed)');
  assert(scD.sustainability_score === 40, 'Scenario D Total Score = 40');
  assert(scD.priority === 'LOW', 'Scenario D Priority = LOW (<= 50)');

  // 5. SCENARIO E: Historical High Adopter (0 + 18 + 20 = 38 -> LOW)
  console.log('5. Testing Scenario E (Historical Adopter with Current Flood: 38 / 100 LOW)...');
  const resE = await request('POST', `/api/farms/${farmEId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(resE.status === 200, 'Scenario E calculated (200 OK)');
  const scE = resE.body.data;
  assert(scE.scores.adoption === 0, 'Scenario E Adoption = 0');
  assert(scE.scores.continued_adoption === 18, 'Scenario E Continued Adoption = 18 (round(3/5 * 30) = 18)');
  assert(scE.scores.audit === 20, 'Scenario E Audit = 20');
  assert(scE.sustainability_score === 38, 'Scenario E Total Score = 38');
  assert(scE.priority === 'LOW', 'Scenario E Priority = LOW (0-50)');

  // 6. SCENARIO F: Not Yet Audited (0 + 0 + 0 = 0 -> LOW)
  console.log('6. Testing Scenario F (Not Yet Audited: 0 / 100 LOW)...');
  const resF = await request('POST', `/api/farms/${farmFId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(resF.status === 200, 'Scenario F calculated (200 OK)');
  const scF = resF.body.data;
  assert(scF.scores.adoption === 0, 'Scenario F Adoption = 0 (Village Head entry does not award adoption)');
  assert(scF.scores.continued_adoption === 0, 'Scenario F Continued Adoption = 0 (unverified season not counted)');
  assert(scF.scores.audit === 0, 'Scenario F Audit = 0 (no audit recorded)');
  assert(scF.sustainability_score === 0, 'Scenario F Total Score = 0');
  assert(scF.priority === 'LOW', 'Scenario F Priority = LOW');

  // 7. SCENARIO G: Conventional Flood Farm (0 + 0 + 20 = 20 -> LOW)
  console.log('7. Testing Scenario G (Conventional Flood Farm: 20 / 100 LOW)...');
  const resG = await request('POST', `/api/farms/${farmGId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(resG.status === 200, 'Scenario G calculated (200 OK)');
  const scG = resG.body.data;
  assert(scG.scores.adoption === 0, 'Scenario G Adoption = 0');
  assert(scG.scores.continued_adoption === 0, 'Scenario G Continued Adoption = 0');
  assert(scG.scores.audit === 20, 'Scenario G Audit = 20');
  assert(scG.sustainability_score === 20, 'Scenario G Total Score = 20');
  assert(scG.priority === 'LOW', 'Scenario G Priority = LOW');

  // 8. Test Idempotency & Recalculation (updates same row)
  console.log('8. Verifying score recalculation updates same database row...');
  const recalcRes = await request('POST', `/api/farms/${farmAId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026'
  }, vheadAToken);
  assert(recalcRes.body.data.score_id === scA.score_id, 'Score ID remained identical on recalculation');

  // 9. Test Payload Tampering Protection
  console.log('9. Verifying frontend fake score & priority cannot tamper calculation...');
  const tamperRes = await request('POST', `/api/farms/${farmAId}/sustainability-score/calculate`, {
    season_id: 1,
    agricultural_year: '2026',
    sustainability_score: 5,
    priority: 'LOW'
  }, vheadAToken);
  assert(tamperRes.body.data.sustainability_score === 100, 'Backend is single source of truth; fake score ignored');
  assert(tamperRes.body.data.priority === 'HIGH', 'Backend is single source of truth; fake priority ignored');

  // 10. Geographic IDOR: Village Head cross-village access
  console.log('10. Testing Village Head cross-village IDOR protection (403 Forbidden)...');
  const idorRes = await request('GET', `/api/farms/${farmAId}/sustainability-score`, null, vheadBToken);
  assert(idorRes.status === 403, 'Village Head B blocked from accessing Village A farm score (403 Forbidden)');

  // 11. Priority Derivations across all required boundaries:
  console.log('11. Testing exact priority boundary derivations...');
  const { derivePriority } = require('../src/services/sustainabilityScore.service');
  assert(derivePriority(100) === 'HIGH', '100 -> HIGH');
  assert(derivePriority(90) === 'HIGH', '90 -> HIGH');
  assert(derivePriority(76) === 'HIGH', '76 -> HIGH');
  assert(derivePriority(75) === 'MEDIUM', '75 -> MEDIUM');
  assert(derivePriority(51) === 'MEDIUM', '51 -> MEDIUM');
  assert(derivePriority(50) === 'LOW', '50 -> LOW');
  assert(derivePriority(0) === 'LOW', '0 -> LOW');

  console.log('\n========================================================================');
  console.log('ALL NORMALIZED 50/30/20 SUSTAINABILITY SCORE TESTS PASSED!');
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
