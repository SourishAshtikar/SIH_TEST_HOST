const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();
const { query, pool } = require('../src/db');

async function run() {
  console.log("=== GIS ML Predictions & New Year Generation Runner ===");

  // 1. Fetch District and Village master records
  console.log("Fetching geographic master records...");
  const districtsRes = await query('SELECT district_id, name FROM districts');
  const villagesRes = await query('SELECT v.village_id, v.name, v.district_id, d.name as district_name, v.tehsil, v.block, v.station_name, v.latitude, v.longitude FROM villages v JOIN districts d ON v.district_id = d.district_id');
  
  const districts = districtsRes.rows;
  const villages = villagesRes.rows;

  const districtMap = {};
  districts.forEach(d => {
    districtMap[d.district_id] = d;
  });

  // Calculate average coordinates for each district from its villages to use for district-level model predictions
  const districtCoords = {};
  districts.forEach(d => {
    const dVillages = villages.filter(v => v.district_id === d.district_id && v.latitude && v.longitude);
    if (dVillages.length > 0) {
      const sumLat = dVillages.reduce((sum, v) => sum + parseFloat(v.latitude), 0);
      const sumLng = dVillages.reduce((sum, v) => sum + parseFloat(v.longitude), 0);
      districtCoords[d.district_id] = {
        latitude: sumLat / dVillages.length,
        longitude: sumLng / dVillages.length
      };
    } else {
      districtCoords[d.district_id] = { latitude: 29.15, longitude: 76.3 }; // fallback Haryana centroid
    }
  });

  // Calculate average rainfall for each district to use for future years
  console.log("Calculating historical rainfall averages by district...");
  const rainfallRes = await query(`
    SELECT district_id, AVG(rainfall_mm) as avg_rainfall
    FROM groundwater_assessments
    WHERE district_id IS NOT NULL AND village_id IS NULL AND rainfall_mm IS NOT NULL
    GROUP BY district_id
  `);
  const districtRainfall = {};
  rainfallRes.rows.forEach(r => {
    districtRainfall[r.district_id] = parseFloat(r.avg_rainfall) || 650.0;
  });
  // fallback for any district without records
  districts.forEach(d => {
    if (!districtRainfall[d.district_id]) {
      districtRainfall[d.district_id] = 650.0;
    }
  });

  // 2. Query all existing assessments where dtw_m_bgl IS NULL for years 2023-2024, 2024-2025, 2025-2026, 2026-2027
  console.log("Locating existing assessments with missing dtw_m_bgl...");
  const missingRes = await query(`
    SELECT assessment_id, district_id, village_id, assessment_year, rainfall_mm, category
    FROM groundwater_assessments
    WHERE dtw_m_bgl IS NULL AND assessment_year IN ('2023-2024', '2024-2025', '2025-2026', '2026-2027')
  `);
  const missingRows = missingRes.rows;
  console.log(`Found ${missingRows.length} records with missing dtw_m_bgl.`);

  // Build items for model execution
  const predictionItems = [];

  missingRows.forEach(row => {
    const yearNum = parseInt(row.assessment_year.split('-')[0], 10);
    if (row.village_id) {
      // Village level
      const v = villages.find(vil => vil.village_id === row.village_id);
      if (v) {
        predictionItems.push({
          type: 'update',
          assessment_id: row.assessment_id,
          scope: 'village',
          district_id: v.district_id,
          village_id: v.village_id,
          district_name: v.district_name,
          tehsil: v.tehsil || v.name,
          block: v.block || v.name,
          station_name: v.station_name || v.name,
          name: v.name,
          latitude: v.latitude || 29.15,
          longitude: v.longitude || 76.3,
          year: yearNum,
          month: 6,
          rainfall_mm: parseFloat(row.rainfall_mm) || districtRainfall[v.district_id],
          soil_moisture: 0.26
        });
      }
    } else {
      // District level
      const d = districtMap[row.district_id];
      const coords = districtCoords[row.district_id];
      if (d) {
        predictionItems.push({
          type: 'update',
          assessment_id: row.assessment_id,
          scope: 'district',
          district_id: d.district_id,
          district_name: d.name,
          name: d.name,
          latitude: coords.latitude,
          longitude: coords.longitude,
          year: yearNum,
          month: 6,
          rainfall_mm: parseFloat(row.rainfall_mm) || districtRainfall[d.district_id],
          soil_moisture: 0.26
        });
      }
    }
  });

  // 3. Generate predictions for a brand new year (e.g. 2027-2028)
  const newYear = '2027-2028';
  const newYearNum = 2027;
  console.log(`Generating prediction items for new year: ${newYear}...`);

  // District-level new year items
  districts.forEach(d => {
    const coords = districtCoords[d.district_id];
    predictionItems.push({
      type: 'insert',
      scope: 'district',
      district_id: d.district_id,
      district_name: d.name,
      name: d.name,
      latitude: coords.latitude,
      longitude: coords.longitude,
      year: newYearNum,
      month: 6,
      rainfall_mm: districtRainfall[d.district_id] * 0.98, // apply slight climate variation
      soil_moisture: 0.24,
      assessment_year: newYear,
      is_predicted: true
    });
  });

  // Village-level new year items
  villages.forEach(v => {
    predictionItems.push({
      type: 'insert',
      scope: 'village',
      district_id: v.district_id,
      village_id: v.village_id,
      district_name: v.district_name,
      tehsil: v.tehsil || v.name,
      block: v.block || v.name,
      station_name: v.station_name || v.name,
      name: v.name,
      latitude: v.latitude || 29.15,
      longitude: v.longitude || 76.3,
      year: newYearNum,
      month: 6,
      rainfall_mm: districtRainfall[v.district_id] * 0.98,
      soil_moisture: 0.24,
      assessment_year: newYear,
      is_predicted: true
    });
  });

  // Write temporary input file
  const scratchDir = path.join(__dirname, '../scratch');
  const inputPath = path.join(scratchDir, 'input_predictions.json');
  const outputPath = path.join(scratchDir, 'output_predictions.json');

  fs.writeFileSync(inputPath, JSON.stringify(predictionItems, null, 2), 'utf8');
  console.log(`Wrote ${predictionItems.length} items to ${inputPath}`);

  // Invoke python bridge script
  console.log("Invoking Python ML bridge script...");
  const bridgeScript = path.join(scratchDir, 'run_predictions_bridge.py');
  try {
    execSync(`python "${bridgeScript}" "${inputPath}" "${outputPath}"`, { stdio: 'inherit' });
    console.log("Python bridge executed successfully.");
  } catch (err) {
    console.error("Python bridge execution failed:", err.message);
    process.exit(1);
  }

  // Read outputs
  const outputData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  if (outputData.status !== 'success') {
    console.error("Prediction failed:", outputData.message);
    process.exit(1);
  }

  const results = outputData.data;
  console.log(`Received ${results.length} predictions from ML models.`);

  // 4. Update and Insert records in database
  console.log("Applying predictions to database...");
  let updatesCount = 0;
  let insertsCount = 0;

  // Clear any existing records for the new year first to allow clean re-runs
  await query("DELETE FROM groundwater_assessments WHERE assessment_year = $1", [newYear]);

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const itemOrig = predictionItems[i];

    if (itemOrig.type === 'update') {
      // Update existing record's dtw_m_bgl and recharge/extraction/category if needed
      await query(`
        UPDATE groundwater_assessments
        SET dtw_m_bgl = $1
        WHERE assessment_id = $2
      `, [res.dtw_m_bgl, itemOrig.assessment_id]);
      updatesCount++;
    } else {
      // Insert new record
      if (res.scope === 'district') {
        await query(`
          INSERT INTO groundwater_assessments 
            (district_id, assessment_year, is_predicted, extractable_resources_bcm, 
             extraction_all_uses_bcm, rainfall_mm, recharge_bcm, natural_discharges_bcm, 
             category, dtw_m_bgl)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          res.id, itemOrig.assessment_year, itemOrig.is_predicted, res.extractable_resources_bcm,
          res.extraction_all_uses_bcm, res.rainfall_mm, res.recharge_bcm, res.natural_discharges_bcm,
          res.category, res.dtw_m_bgl
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
          res.id, itemOrig.assessment_year, itemOrig.is_predicted, res.extractable_resources_bcm,
          res.extraction_all_uses_bcm, res.rainfall_mm, res.recharge_bcm, res.natural_discharges_bcm,
          res.category, res.dtw_m_bgl
        ]);
      }
      insertsCount++;
    }
  }

  console.log(`Database updates complete! Updates applied: ${updatesCount}, New inserts: ${insertsCount}.`);
  
  // Reset frontend yearsLoaded flag to force a reload of the year selector dropdown with the new year option
  console.log("Completed successfully.");
}

run().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
}).finally(() => {
  pool.end();
});
