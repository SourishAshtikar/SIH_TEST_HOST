const villageService = require('./villageService');
const groundwaterService = require('./groundwaterService');
const weatherService = require('./weatherService');
const soilService = require('./soilService');
const { evaluateRecommendation } = require('../engine/recommendationEngine');

async function generateRecommendation(payload) {
  const { villageId, village, crop, cropName, currentPractice, currentPracticeName } = payload;

  const targetVillageId = villageId || village;
  const targetCropName = cropName || crop;
  const targetPracticeName = currentPracticeName || currentPractice;

  if (!targetVillageId) {
    throw new Error('village (or villageId) is required');
  }

  // 1. Resolve Village Master Record by LGD Code or ID
  const villageRecord = await villageService.getVillageById(targetVillageId);
  if (!villageRecord) {
    throw new Error(`Village with identifier '${targetVillageId}' not found`);
  }

  // 2. Resolve Soil Mapping (Semi-static)
  const soil = await soilService.getSoilInfo(villageRecord);

  // 3. Resolve Groundwater Output (ML Model execution)
  const groundwater = await groundwaterService.getGroundwaterInfo(
    villageRecord.latitude,
    villageRecord.longitude,
    targetCropName,
    villageRecord
  );

  // 4. Fetch Weather / Rainfall (Open-Meteo API)
  const weather = await weatherService.getWeatherInfo(
    villageRecord.latitude,
    villageRecord.longitude
  );

  // 5. Fetch latest database/ML groundwater assessment metrics
  let dbAssessment = { recharge_bcm: 1.2, extraction_all_uses_bcm: 0.9, rainfall_mm: 600.0 };
  try {
    const { query } = require('../db');
    const gwRes = await query(`
      SELECT recharge_bcm, extraction_all_uses_bcm, rainfall_mm 
      FROM groundwater_assessments 
      WHERE (village_id = $1 OR district_id = $2)
      ORDER BY assessment_year DESC, village_id DESC NULLS LAST LIMIT 1
    `, [villageRecord.village_id, villageRecord.district_id]);
    
    if (gwRes.rows.length > 0) {
      dbAssessment = gwRes.rows[0];
    }
  } catch (err) {
    console.warn(`[RecommendationService] Failed to load DB assessment metrics: ${err.message}`);
  }

  // 6. Run ML-integrated / Rule Engine
  const recommendationReport = await evaluateRecommendation({
    village: villageRecord,
    cropName: targetCropName,
    currentPracticeName: targetPracticeName,
    groundwater,
    weather,
    soil,
    assessment: dbAssessment
  });

  return recommendationReport;
}

module.exports = {
  generateRecommendation
};
