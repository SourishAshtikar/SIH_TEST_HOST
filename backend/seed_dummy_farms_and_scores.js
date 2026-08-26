const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { query, pool } = require('./src/db');
const { calculateAndPersistScore } = require('./src/services/sustainabilityScore.service');

async function seedDummyData() {
  console.log('🌱 Cleaning old farm records, audits, and scores...');

  // 1. Clean existing farm data
  await query('DELETE FROM sustainability_scores');
  await query('DELETE FROM audits');
  await query('DELETE FROM farm_crop_records');
  await query('DELETE FROM farms');

  // Reset serial sequences if needed
  try {
    await query('ALTER SEQUENCE farms_farm_id_seq RESTART WITH 1');
    await query('ALTER SEQUENCE farm_crop_records_record_id_seq RESTART WITH 1');
    await query('ALTER SEQUENCE audits_audit_id_seq RESTART WITH 1');
    await query('ALTER SEQUENCE sustainability_scores_score_id_seq RESTART WITH 1');
  } catch (e) {
    // Sequence fallback
  }

  // Get auditor user ID for Karnal (District 1)
  const auditorRes = await query("SELECT id FROM users WHERE email = 'test_auditor@example.com' OR role = 'AUDITOR' LIMIT 1");
  const auditorId = auditorRes.rows[0]?.id || 2;

  console.log(`Using Auditor ID: ${auditorId}`);

  // 2. Define realistic farms with normalized 50/30/20 scores
  const farmDefinitions = [
    {
      // Perfect Adopter: 50 + 30 + 20 = 100 (HIGH)
      name: 'Golden Harvest Agro Farm',
      owner_name: 'Baldev Singh',
      village_id: 1,
      total_land_area_hectares: 4.5,
      latitude: 29.5378,
      longitude: 76.9731,
      records: [
        { season_id: 1, year: '2025', crop_id: 1, area: 4.0, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Drip installed successfully' },
        { season_id: 2, year: '2025', crop_id: 2, area: 4.0, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Micro-irrigation continued' },
        { season_id: 1, year: '2026', crop_id: 1, area: 4.5, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Full compliance verified' }
      ]
    },
    {
      // First-Time Verified Adopter: 50 + 30 + 20 = 100 (HIGH)
      name: 'Kisan Pragati Kendra',
      owner_name: 'Devender Rawat',
      village_id: 1,
      total_land_area_hectares: 4.2,
      latitude: 29.5380,
      longitude: 76.9720,
      records: [
        { season_id: 1, year: '2026', crop_id: 1, area: 4.2, method_id: 3, audited: true, status: 'ADOPTED', actual_method: 3, notes: 'First season verified adoption' }
      ]
    },
    {
      // Pehowa Verified Farm: 50 + 30 + 20 = 100 (HIGH)
      name: 'Brahma Sarovar Farm',
      owner_name: 'Manish Chawla',
      village_id: 3, // Pehowa, Kurukshetra
      total_land_area_hectares: 4.8,
      latitude: 29.9810,
      longitude: 76.5835,
      records: [
        { season_id: 1, year: '2025', crop_id: 1, area: 4.5, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Pehowa drip model' },
        { season_id: 1, year: '2026', crop_id: 1, area: 4.8, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Verified 100% adoption' }
      ]
    },
    {
      // Improving Farm: 2/3 adopted = 20 cont -> 50 + 20 + 20 = 90 (HIGH)
      name: 'Green Fields Micro-Irrigation Estate',
      owner_name: 'Sukhwinder Kaur',
      village_id: 1,
      total_land_area_hectares: 3.2,
      latitude: 29.5365,
      longitude: 76.9715,
      records: [
        { season_id: 1, year: '2025', crop_id: 1, area: 3.0, method_id: 1, audited: true, status: 'NOT_ADOPTED', actual_method: 1, notes: 'Conventional flood noted' },
        { season_id: 2, year: '2025', crop_id: 2, area: 3.0, method_id: 3, audited: true, status: 'ADOPTED', actual_method: 3, notes: 'Sprinkler adopted' },
        { season_id: 1, year: '2026', crop_id: 1, area: 3.2, method_id: 3, audited: true, status: 'ADOPTED', actual_method: 3, notes: 'Sprinkler active & working' }
      ]
    },
    {
      // Moderate Adoption Continuity: 1/3 adopted = 10 cont -> 50 + 10 + 20 = 80 (HIGH)
      name: 'Satluj Eco Agro Holdings',
      owner_name: 'Virender Hooda',
      village_id: 1,
      total_land_area_hectares: 4.0,
      latitude: 29.5360,
      longitude: 76.9760,
      records: [
        { season_id: 1, year: '2025', crop_id: 1, area: 4.0, method_id: 1, audited: true, status: 'NOT_ADOPTED', actual_method: 1, notes: 'Flood irrigation' },
        { season_id: 2, year: '2025', crop_id: 2, area: 4.0, method_id: 1, audited: true, status: 'NOT_ADOPTED', actual_method: 1, notes: 'Flood irrigation' },
        { season_id: 1, year: '2026', crop_id: 1, area: 4.0, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Micro-irrigation adopted this Kharif' }
      ]
    },
    {
      // Historical High Adopter Current Relapse: 3/4 adopted = 23 cont -> 0 + 23 + 20 = 43 (LOW)
      name: 'Vedic Ganga Agro Farm',
      owner_name: 'Kuldeep Nain',
      village_id: 1,
      total_land_area_hectares: 3.5,
      latitude: 29.5370,
      longitude: 76.9748,
      records: [
        { season_id: 1, year: '2024', crop_id: 1, area: 3.5, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Drip verified' },
        { season_id: 1, year: '2025', crop_id: 1, area: 3.5, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Drip verified' },
        { season_id: 2, year: '2025', crop_id: 2, area: 3.5, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Sprinkler verified' },
        { season_id: 1, year: '2026', crop_id: 1, area: 3.5, method_id: 2, audited: true, status: 'NOT_ADOPTED', actual_method: 1, notes: 'Paddy flooded due to pump repair' }
      ]
    },
    {
      // 2/3 Historical Adopter Current Flood: 2/3 = 20 cont -> 0 + 20 + 20 = 40 (LOW)
      name: 'Pawanputra Krishi Kendra',
      owner_name: 'Rajesh Sharma',
      village_id: 1,
      total_land_area_hectares: 2.8,
      latitude: 29.5390,
      longitude: 76.9740,
      records: [
        { season_id: 1, year: '2025', crop_id: 1, area: 2.5, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Drip verified' },
        { season_id: 2, year: '2025', crop_id: 2, area: 2.5, method_id: 2, audited: true, status: 'ADOPTED', actual_method: 2, notes: 'Sprinkler verified' },
        { season_id: 1, year: '2026', crop_id: 1, area: 2.8, method_id: 1, audited: true, status: 'NOT_ADOPTED', actual_method: 1, notes: 'Canal flood used' }
      ]
    },
    {
      // Conventional Flood Farm: 0 + 0 + 20 = 20 (LOW)
      name: 'Navdeep Agro Orchards',
      owner_name: 'Navdeep Malik',
      village_id: 1,
      total_land_area_hectares: 5.0,
      latitude: 29.5350,
      longitude: 76.9705,
      records: [
        { season_id: 1, year: '2026', crop_id: 1, area: 5.0, method_id: 1, audited: true, status: 'NOT_ADOPTED', actual_method: 1, notes: 'Conventional flood irrigation' }
      ]
    },
    {
      // Unaudited Farm: 0 + 0 + 0 = 0 (LOW)
      name: 'Yamuna Basin Organic Farm',
      owner_name: 'Harpreet Dhillon',
      village_id: 1,
      total_land_area_hectares: 3.8,
      latitude: 29.5385,
      longitude: 76.9755,
      records: [
        { season_id: 1, year: '2026', crop_id: 1, area: 3.5, method_id: 3, audited: false, notes: 'Awaiting seasonal audit inspection' }
      ]
    }
  ];

  console.log('🌾 Inserting farms, seasonal crop records, and field audits...');

  for (const f of farmDefinitions) {
    const farmRes = await query(`
      INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING farm_id
    `, [f.name, f.owner_name, f.village_id, f.total_land_area_hectares, f.latitude, f.longitude]);

    const farmId = farmRes.rows[0].farm_id;

    for (const r of f.records) {
      const recRes = await query(`
        INSERT INTO farm_crop_records (farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING record_id
      `, [farmId, r.season_id, r.year, r.crop_id, r.area, r.method_id]);

      const recordId = recRes.rows[0].record_id;

      if (r.audited) {
        await query(`
          INSERT INTO audits (record_id, auditor_id, actual_irrigation_method_id, adoption_status, audit_date, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [recordId, auditorId, r.actual_method, r.status, '2026-08-20', r.notes]);
      }
    }

    // Calculate and persist current season (2026 Kharif) score for the farm
    await calculateAndPersistScore(farmId, 1, '2026');
  }

  // 3. Print verification table of all newly generated scores
  const allScores = await query(`
    SELECT s.farm_id, f.name as farm_name, f.owner_name, v.name as village_name,
           s.adoption_score, s.continued_adoption_score, s.audit_score,
           s.sustainability_score, s.priority
    FROM sustainability_scores s
    JOIN farms f ON s.farm_id = f.farm_id
    JOIN villages v ON f.village_id = v.village_id
    ORDER BY s.sustainability_score DESC, s.farm_id ASC
  `);

  console.log('\n========================================================================================================');
  console.log('🏆 SEEDED NORMALIZED (50/30/20) SUSTAINABILITY SCORES & GOVERNMENT PRIORITIES (2026 Kharif):');
  console.log('========================================================================================================');
  console.table(allScores.rows.map(r => ({
    'Farm ID': `#${r.farm_id}`,
    'Farm Name': r.farm_name,
    'Owner': r.owner_name,
    'Village': r.village_name,
    'Adoption': `${r.adoption_score}/50`,
    'Continued': `${r.continued_adoption_score}/30`,
    'Audit': `${r.audit_score}/20`,
    'Total Score': `${r.sustainability_score} / 100`,
    'Priority': r.priority
  })));
  console.log('========================================================================================================\n');

  await pool.end();
}

seedDummyData().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
