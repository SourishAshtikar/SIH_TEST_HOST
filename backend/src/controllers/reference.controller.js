const { query } = require('../db');
const fallbackCrops = require('../data/crops.json');
const fallbackPractices = require('../data/irrigationPractices.json');

async function getRecommendationReferenceData(req, res, next) {
  try {
    const [cropsRes, practicesRes] = await Promise.all([
      query(`
        SELECT 
          crop_id AS id, 
          name, 
          season, 
          water_requirement_class AS "waterRequirementClass",
          priority,
          suitable_practices AS "suitablePractices",
          water_saving_practices AS "waterSavingPractices",
          critical_irrigation_stages AS "criticalIrrigationStages"
        FROM crops 
        ORDER BY crop_id ASC
      `),
      query(`
        SELECT 
          code AS id, 
          name, 
          water_efficiency AS "waterEfficiency",
          water_savings_percentage AS "waterSavingsPercentage",
          energy_savings_percentage AS "energySavingsPercentage"
        FROM irrigation_methods 
        ORDER BY method_id ASC
      `)
    ]);

    const crops = cropsRes.rows.length > 0 ? cropsRes.rows : fallbackCrops.crops;
    const irrigationPractices = practicesRes.rows.length > 0 ? practicesRes.rows : fallbackPractices.practices;

    res.json({
      status: 'SUCCESS',
      data: {
        crops,
        irrigationPractices
      }
    });
  } catch (err) {
    // If DB fails, fallback gracefully to JSON
    console.warn('[ReferenceController] Falling back to JSON static data:', err.message);
    res.json({
      status: 'SUCCESS',
      data: {
        crops: fallbackCrops.crops,
        irrigationPractices: fallbackPractices.practices
      }
    });
  }
}

module.exports = { getRecommendationReferenceData };
