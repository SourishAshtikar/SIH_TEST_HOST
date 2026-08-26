const { query } = require('../db');

async function getSeasons() {
  const res = await query('SELECT season_id AS id, name FROM seasons ORDER BY season_id ASC');
  return res.rows;
}

async function getSeasonById(seasonId) {
  const res = await query('SELECT season_id AS id, name FROM seasons WHERE season_id = $1', [seasonId]);
  return res.rows[0] || null;
}

async function getCrops(seasonId) {
  let sql = `
    SELECT 
      crop_id AS id, 
      name, 
      season,
      water_requirement,
      water_requirement_class,
      priority,
      suitable_practices,
      water_saving_practices,
      critical_irrigation_stages
    FROM crops
  `;
  const params = [];
  if (seasonId) {
    sql += ' WHERE season_id = $1';
    params.push(seasonId);
  }
  sql += ' ORDER BY crop_id ASC';

  const res = await query(sql, params);
  return res.rows;
}

async function getCropById(cropId) {
  const res = await query(
    `SELECT 
      crop_id AS id, 
      name, 
      season,
      water_requirement,
      water_requirement_class,
      priority,
      suitable_practices,
      water_saving_practices,
      critical_irrigation_stages
    FROM crops 
    WHERE crop_id = $1`,
    [cropId]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];

  return {
    id: row.id,
    name: row.name,
    season: row.season,
    waterRequirementClass: row.water_requirement_class || row.water_requirement || 'Medium',
    priority: row.priority,
    suitablePractices: row.suitable_practices || [],
    waterSavingPractices: row.water_saving_practices || [],
    criticalIrrigationStages: row.critical_irrigation_stages || []
  };
}

async function getIrrigationMethods() {
  const res = await query(`
    SELECT 
      method_id AS id, 
      code,
      name,
      water_efficiency,
      water_savings_percentage,
      energy_savings_percentage
    FROM irrigation_methods 
    ORDER BY method_id ASC
  `);
  return res.rows;
}

async function getIrrigationMethodById(methodId) {
  const res = await query(`
    SELECT 
      method_id AS id, 
      code,
      name,
      water_efficiency,
      water_savings_percentage,
      energy_savings_percentage
    FROM irrigation_methods 
    WHERE method_id = $1
  `, [methodId]);
  return res.rows[0] || null;
}

module.exports = {
  getSeasons,
  getSeasonById,
  getCrops,
  getCropById,
  getIrrigationMethods,
  getIrrigationMethodById
};
