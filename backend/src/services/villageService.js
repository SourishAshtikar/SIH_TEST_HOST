const { query } = require('../db');
const villagesData = require('../data/villages.json');

/**
 * Resolves village master record directly from the PostgreSQL database,
 * falling back to static dataset if database is offline.
 */
async function getVillageById(villageIdentifier) {
  if (!villageIdentifier) return null;

  const idStr = String(villageIdentifier).trim();

  try {
    const dbRes = await query(`
      SELECT 
        v.village_id AS "id",
        v.village_id,
        v.name AS "villageName",
        v.name,
        v.district_id,
        d.name AS "district",
        d.name AS "districtName",
        v.lgd_code AS "lgdCode",
        v.tehsil,
        v.block,
        COALESCE(v.station_name, v.name) AS "stationName",
        COALESCE(v.station_name, v.name) AS "station",
        v.latitude,
        v.longitude
      FROM villages v
      JOIN districts d ON v.district_id = d.district_id
      WHERE v.village_id::text = $1 OR v.lgd_code = $1 OR LOWER(v.name) = LOWER($1)
      LIMIT 1;
    `, [idStr]);

    if (dbRes.rows.length > 0) {
      const row = dbRes.rows[0];
      return {
        ...row,
        latitude: row.latitude !== null ? parseFloat(row.latitude) : 29.5372,
        longitude: row.longitude !== null ? parseFloat(row.longitude) : 76.9722
      };
    }
  } catch (err) {
    console.warn('⚠️ Database village lookup error, using fallback:', err.message);
  }

  // Fallback to static JSON if not found in database
  const lowerStr = idStr.toLowerCase();
  const match = villagesData.find(
    v => String(v.lgdCode).toLowerCase() === lowerStr ||
         v.villageName.toLowerCase() === lowerStr ||
         (v.id && String(v.id).toLowerCase() === lowerStr)
  );

  if (match) return match;

  if (!isNaN(parseInt(idStr, 10))) {
    const idx = (parseInt(idStr, 10) % villagesData.length);
    return villagesData[idx] || villagesData[0];
  }

  return villagesData[0];
}

async function getAllVillages() {
  try {
    const dbRes = await query(`
      SELECT 
        v.village_id AS "id",
        v.name AS "villageName",
        d.name AS "district",
        v.lgd_code AS "lgdCode",
        v.tehsil,
        v.block,
        v.station_name AS "stationName",
        v.latitude,
        v.longitude
      FROM villages v
      JOIN districts d ON v.district_id = d.district_id
      ORDER BY v.name ASC;
    `);
    if (dbRes.rows.length > 0) return dbRes.rows;
  } catch (err) {
    console.warn('⚠️ Database getAllVillages error, using fallback:', err.message);
  }
  return villagesData;
}

module.exports = {
  getVillageById,
  getAllVillages
};
