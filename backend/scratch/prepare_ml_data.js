const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { query, pool } = require('../src/db');

async function run() {
  console.log("=== Preparing database records for ML pipeline ===");
  
  // 1. Fetch District master
  const districts = await query('SELECT district_id, name FROM districts');
  
  // 2. Fetch Village master
  const villages = await query('SELECT village_id, name, district_id FROM villages');
  
  // 3. Fetch Historical Groundwater Assessments
  const assessments = await query(`
    SELECT district_id, village_id, assessment_year, is_predicted,
           extractable_resources_bcm, extraction_all_uses_bcm,
           rainfall_mm, recharge_bcm, category, dtw_m_bgl
    FROM groundwater_assessments
    WHERE is_predicted = false AND assessment_year IN ('2023-2024', '2024-2025')
  `);
  
  const payload = {
    districts: districts.rows,
    villages: villages.rows,
    assessments: assessments.rows
  };
  
  const outputPath = path.join(__dirname, '../Model/db_historical_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`SUCCESS! Saved database snapshot to ${outputPath}`);
}

run().catch(err => {
  console.error("Data prep failed:", err);
  process.exit(1);
}).finally(() => {
  pool.end();
});
