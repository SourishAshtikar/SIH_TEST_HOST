const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { query, pool } = require('../src/db');

async function run() {
  console.log("=== Seeding Groundwater Predictions from ML model ===");
  
  const predPath = path.join(__dirname, '../Model/predicted_assessments.json');
  if (!fs.existsSync(predPath)) {
    console.error(`Predictions snapshot not found at ${predPath}`);
    process.exit(1);
  }
  
  const predictions = JSON.parse(fs.readFileSync(predPath, 'utf8'));
  console.log(`Loaded ${predictions.length} predictions from file.`);
  
  // Clear any existing predicted records for the predicted years first
  await query("DELETE FROM groundwater_assessments WHERE is_predicted = true AND assessment_year IN ('2025-2026', '2026-2027')");
  
  let count = 0;
  for (const pred of predictions) {
    if (pred.scope === 'district') {
      await query(`
        INSERT INTO groundwater_assessments 
          (district_id, assessment_year, is_predicted, extractable_resources_bcm, 
           extraction_all_uses_bcm, rainfall_mm, recharge_bcm, natural_discharges_bcm, 
           category, dtw_m_bgl)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        pred.district_id, pred.assessment_year, pred.is_predicted, pred.extractable_resources_bcm,
        pred.extraction_all_uses_bcm, pred.rainfall_mm, pred.recharge_bcm, pred.natural_discharges_bcm,
        pred.category, pred.dtw_m_bgl
      ]);
    } else {
      await query(`
        INSERT INTO groundwater_assessments 
          (village_id, assessment_year, is_predicted, extractable_resources_bcm, 
           extraction_all_uses_bcm, rainfall_mm, recharge_bcm, natural_discharges_bcm, 
           category, dtw_m_bgl)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        pred.village_id, pred.assessment_year, pred.is_predicted, pred.extractable_resources_bcm,
        pred.extraction_all_uses_bcm, pred.rainfall_mm, pred.recharge_bcm, pred.natural_discharges_bcm,
        pred.category, pred.dtw_m_bgl
      ]);
    }
    count++;
  }
  
  console.log(`SUCCESS! Inserted ${count} predicted records into PostgreSQL database.`);
}

run().catch(err => {
  console.error("Failed to seed predictions:", err);
  process.exit(1);
}).finally(() => {
  pool.end();
});
