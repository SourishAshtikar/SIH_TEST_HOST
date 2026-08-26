const { query } = require('../db');

/**
 * Helper to fetch authenticated user with current geographic assignment
 */
async function getUserWithGeography(userId) {
  const result = await query('SELECT id, name, email, role, district_id, village_id FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
}

/**
 * Helper to fetch farm with village and district geographic hierarchy
 */
async function getFarmWithGeography(farmId) {
  const parsedFarmId = parseInt(farmId, 10);
  if (isNaN(parsedFarmId)) {
    const error = new Error('Valid numeric farm_id is required');
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `SELECT f.farm_id, f.name, f.owner_name, f.village_id, f.total_land_area_hectares,
            v.name AS village_name, v.district_id,
            d.name AS district_name,
            s.name AS state_name
     FROM farms f
     JOIN villages v ON v.village_id = f.village_id
     JOIN districts d ON d.district_id = v.district_id
     JOIN states s ON s.state_id = d.state_id
     WHERE f.farm_id = $1`,
    [parsedFarmId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Farm not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

/**
 * Helper to fetch crop record with complete relational details
 */
async function getCropRecordWithHierarchy(recordId) {
  const parsedRecordId = parseInt(recordId, 10);
  if (isNaN(parsedRecordId)) {
    const error = new Error('Valid numeric record_id is required');
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `SELECT r.record_id, r.farm_id, r.season_id, r.agricultural_year, r.crop_id,
            r.cultivated_area_hectares, r.current_irrigation_method_id, r.created_at,
            s.name AS season_name,
            c.name AS crop_name, c.water_requirement,
            im.name AS current_irrigation_method_name,
            f.name AS farm_name, f.owner_name, f.village_id,
            v.name AS village_name, v.district_id,
            d.name AS district_name
     FROM farm_crop_records r
     JOIN seasons s ON s.season_id = r.season_id
     JOIN crops c ON c.crop_id = r.crop_id
     LEFT JOIN irrigation_methods im ON im.method_id = r.current_irrigation_method_id
     JOIN farms f ON f.farm_id = r.farm_id
     JOIN villages v ON v.village_id = f.village_id
     JOIN districts d ON d.district_id = v.district_id
     WHERE r.record_id = $1`,
    [parsedRecordId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Seasonal crop record not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

/**
 * Create a new seasonal crop record for a farm
 */
const createCropRecord = async (userId, farmId, { season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id }) => {
  const user = await getUserWithGeography(userId);

  // 1. Role verification: ONLY VILLAGE_HEAD can create
  if (user.role !== 'VILLAGE_HEAD') {
    const error = new Error('Access forbidden: Only Village Heads may manage seasonal crop records');
    error.statusCode = 403;
    throw error;
  }

  if (!user.village_id) {
    const error = new Error('Access forbidden: Village Head is not assigned to any village');
    error.statusCode = 403;
    throw error;
  }

  // 2. Fetch farm and enforce geographic authorization
  const farm = await getFarmWithGeography(farmId);
  if (farm.village_id !== user.village_id) {
    const error = new Error('Access forbidden: You do not have authority over farms outside your assigned village');
    error.statusCode = 403;
    throw error;
  }

  // 3. Validate season_id
  if (season_id === undefined || season_id === null || isNaN(parseInt(season_id, 10))) {
    const error = new Error('Valid season_id is required');
    error.statusCode = 400;
    throw error;
  }
  const parsedSeasonId = parseInt(season_id, 10);
  const seasonCheck = await query('SELECT season_id FROM seasons WHERE season_id = $1', [parsedSeasonId]);
  if (seasonCheck.rows.length === 0) {
    const error = new Error('Invalid season_id: Season does not exist');
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate agricultural_year
  if (!agricultural_year || typeof agricultural_year !== 'string' || !agricultural_year.trim()) {
    const error = new Error('Valid agricultural_year is required');
    error.statusCode = 400;
    throw error;
  }
  const cleanYear = agricultural_year.trim();

  // 5. Validate crop_id
  if (crop_id === undefined || crop_id === null || isNaN(parseInt(crop_id, 10))) {
    const error = new Error('Valid crop_id is required');
    error.statusCode = 400;
    throw error;
  }
  const parsedCropId = parseInt(crop_id, 10);
  const cropCheck = await query('SELECT crop_id FROM crops WHERE crop_id = $1', [parsedCropId]);
  if (cropCheck.rows.length === 0) {
    const error = new Error('Invalid crop_id: Crop does not exist');
    error.statusCode = 400;
    throw error;
  }

  // 6. Validate cultivated_area_hectares
  if (
    cultivated_area_hectares === undefined ||
    cultivated_area_hectares === null ||
    isNaN(parseFloat(cultivated_area_hectares)) ||
    parseFloat(cultivated_area_hectares) <= 0
  ) {
    const error = new Error('Cultivated area must be a positive number');
    error.statusCode = 400;
    throw error;
  }
  const cleanArea = parseFloat(cultivated_area_hectares);

  // 7. Validate current_irrigation_method_id if provided
  let cleanMethodId = null;
  if (current_irrigation_method_id !== undefined && current_irrigation_method_id !== null) {
    const parsedMethodId = parseInt(current_irrigation_method_id, 10);
    if (isNaN(parsedMethodId)) {
      const error = new Error('Invalid current_irrigation_method_id');
      error.statusCode = 400;
      throw error;
    }
    const methodCheck = await query('SELECT method_id FROM irrigation_methods WHERE method_id = $1', [parsedMethodId]);
    if (methodCheck.rows.length === 0) {
      const error = new Error('Invalid current_irrigation_method_id: Irrigation method does not exist');
      error.statusCode = 400;
      throw error;
    }
    cleanMethodId = parsedMethodId;
  }

  // 8. Check uniqueness constraint: (farm_id, season_id, agricultural_year, crop_id)
  const existingDup = await query(
    'SELECT record_id FROM farm_crop_records WHERE farm_id = $1 AND season_id = $2 AND agricultural_year = $3 AND crop_id = $4',
    [farm.farm_id, parsedSeasonId, cleanYear, parsedCropId]
  );
  if (existingDup.rows.length > 0) {
    const error = new Error('A crop record for this farm, season, agricultural year, and crop already exists');
    error.statusCode = 409;
    throw error;
  }

  // 9. Insert record
  const result = await query(
    `INSERT INTO farm_crop_records (farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING record_id, farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id, created_at`,
    [farm.farm_id, parsedSeasonId, cleanYear, parsedCropId, cleanArea, cleanMethodId]
  );

  const savedRecord = result.rows[0];

  // Dynamically calculate and persist the entire farm's sustainability score for this season/year
  try {
    const { calculateAndPersistScore } = require('./sustainabilityScore.service');
    await calculateAndPersistScore(farm.farm_id, parsedSeasonId, cleanYear);
  } catch (e) {
    console.warn('Dynamic sustainability score update notification:', e.message);
  }

  return savedRecord;
};

/**
 * List all crop records for a specific farm with geographic authorization
 */
const getCropRecordsByFarm = async (userId, farmId) => {
  const user = await getUserWithGeography(userId);
  const farm = await getFarmWithGeography(farmId);

  // Enforce geographic scope by user role
  if (user.role === 'VILLAGE_HEAD') {
    if (!user.village_id || farm.village_id !== user.village_id) {
      const error = new Error('Access forbidden: You do not have authority over farms outside your assigned village');
      error.statusCode = 403;
      throw error;
    }
  } else if (user.role === 'AUDITOR') {
    if (!user.district_id || farm.district_id !== user.district_id) {
      const error = new Error('Access forbidden: You do not have access to farms outside your assigned district');
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error = new Error('Access forbidden: User role does not have permission to view crop records');
    error.statusCode = 403;
    throw error;
  }

  const result = await query(
    `SELECT r.record_id, r.farm_id, r.season_id, r.agricultural_year, r.crop_id,
            r.cultivated_area_hectares, r.current_irrigation_method_id, r.created_at,
            s.name AS season_name,
            c.name AS crop_name, c.water_requirement,
            im.name AS current_irrigation_method_name
     FROM farm_crop_records r
     JOIN seasons s ON s.season_id = r.season_id
     JOIN crops c ON c.crop_id = r.crop_id
     LEFT JOIN irrigation_methods im ON im.method_id = r.current_irrigation_method_id
     WHERE r.farm_id = $1
     ORDER BY r.agricultural_year DESC, r.season_id ASC, r.record_id ASC`,
    [farm.farm_id]
  );

  return result.rows;
};

/**
 * Retrieve a single seasonal crop record by ID
 */
const getCropRecordById = async (userId, recordId) => {
  const user = await getUserWithGeography(userId);
  const record = await getCropRecordWithHierarchy(recordId);

  if (user.role === 'VILLAGE_HEAD') {
    if (!user.village_id || record.village_id !== user.village_id) {
      const error = new Error('Access forbidden: You do not have authority over records outside your assigned village');
      error.statusCode = 403;
      throw error;
    }
  } else if (user.role === 'AUDITOR') {
    if (!user.district_id || record.district_id !== user.district_id) {
      const error = new Error('Access forbidden: You do not have access to records outside your assigned district');
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error = new Error('Access forbidden: User role does not have permission to view crop records');
    error.statusCode = 403;
    throw error;
  }

  return record;
};

/**
 * Update an existing seasonal crop record
 */
const updateCropRecord = async (userId, recordId, { farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id }) => {
  const user = await getUserWithGeography(userId);

  // 1. Role verification: ONLY VILLAGE_HEAD can update
  if (user.role !== 'VILLAGE_HEAD') {
    const error = new Error('Access forbidden: Only Village Heads may modify seasonal crop records');
    error.statusCode = 403;
    throw error;
  }

  if (!user.village_id) {
    const error = new Error('Access forbidden: Village Head is not assigned to any village');
    error.statusCode = 403;
    throw error;
  }

  const existingRecord = await getCropRecordWithHierarchy(recordId);

  // 2. Geographic authorization check
  if (existingRecord.village_id !== user.village_id) {
    const error = new Error('Access forbidden: You do not have authority over records outside your assigned village');
    error.statusCode = 403;
    throw error;
  }

  // 3. Immutability of farm_id
  if (farm_id !== undefined && farm_id !== null && parseInt(farm_id, 10) !== existingRecord.farm_id) {
    const error = new Error('Farm assignment for a crop record is immutable');
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate and resolve updates
  let updatedSeasonId = existingRecord.season_id;
  if (season_id !== undefined) {
    const parsedSeasonId = parseInt(season_id, 10);
    if (isNaN(parsedSeasonId)) {
      const error = new Error('Invalid season_id');
      error.statusCode = 400;
      throw error;
    }
    const seasonCheck = await query('SELECT season_id FROM seasons WHERE season_id = $1', [parsedSeasonId]);
    if (seasonCheck.rows.length === 0) {
      const error = new Error('Invalid season_id: Season does not exist');
      error.statusCode = 400;
      throw error;
    }
    updatedSeasonId = parsedSeasonId;
  }

  let updatedYear = existingRecord.agricultural_year;
  if (agricultural_year !== undefined) {
    if (!agricultural_year || typeof agricultural_year !== 'string' || !agricultural_year.trim()) {
      const error = new Error('Agricultural year cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    updatedYear = agricultural_year.trim();
  }

  let updatedCropId = existingRecord.crop_id;
  if (crop_id !== undefined) {
    const parsedCropId = parseInt(crop_id, 10);
    if (isNaN(parsedCropId)) {
      const error = new Error('Invalid crop_id');
      error.statusCode = 400;
      throw error;
    }
    const cropCheck = await query('SELECT crop_id FROM crops WHERE crop_id = $1', [parsedCropId]);
    if (cropCheck.rows.length === 0) {
      const error = new Error('Invalid crop_id: Crop does not exist');
      error.statusCode = 400;
      throw error;
    }
    updatedCropId = parsedCropId;
  }

  let updatedArea = existingRecord.cultivated_area_hectares;
  if (cultivated_area_hectares !== undefined) {
    if (
      cultivated_area_hectares === null ||
      isNaN(parseFloat(cultivated_area_hectares)) ||
      parseFloat(cultivated_area_hectares) <= 0
    ) {
      const error = new Error('Cultivated area must be a positive number');
      error.statusCode = 400;
      throw error;
    }
    updatedArea = parseFloat(cultivated_area_hectares);
  }

  let updatedMethodId = existingRecord.current_irrigation_method_id;
  if (current_irrigation_method_id !== undefined) {
    if (current_irrigation_method_id === null) {
      updatedMethodId = null;
    } else {
      const parsedMethodId = parseInt(current_irrigation_method_id, 10);
      if (isNaN(parsedMethodId)) {
        const error = new Error('Invalid current_irrigation_method_id');
        error.statusCode = 400;
        throw error;
      }
      const methodCheck = await query('SELECT method_id FROM irrigation_methods WHERE method_id = $1', [parsedMethodId]);
      if (methodCheck.rows.length === 0) {
        const error = new Error('Invalid current_irrigation_method_id: Irrigation method does not exist');
        error.statusCode = 400;
        throw error;
      }
      updatedMethodId = parsedMethodId;
    }
  }

  // 5. Check uniqueness collision on update (if season/year/crop modified)
  if (
    updatedSeasonId !== existingRecord.season_id ||
    updatedYear !== existingRecord.agricultural_year ||
    updatedCropId !== existingRecord.crop_id
  ) {
    const dupCheck = await query(
      'SELECT record_id FROM farm_crop_records WHERE farm_id = $1 AND season_id = $2 AND agricultural_year = $3 AND crop_id = $4 AND record_id != $5',
      [existingRecord.farm_id, updatedSeasonId, updatedYear, updatedCropId, existingRecord.record_id]
    );
    if (dupCheck.rows.length > 0) {
      const error = new Error('A crop record for this farm, season, agricultural year, and crop already exists');
      error.statusCode = 409;
      throw error;
    }
  }

  // 6. Update record
  const result = await query(
    `UPDATE farm_crop_records
     SET season_id = $1,
         agricultural_year = $2,
         crop_id = $3,
         cultivated_area_hectares = $4,
         current_irrigation_method_id = $5
     WHERE record_id = $6
     RETURNING record_id, farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id, created_at`,
    [updatedSeasonId, updatedYear, updatedCropId, updatedArea, updatedMethodId, existingRecord.record_id]
  );

  const updatedRecord = result.rows[0];

  // Dynamically calculate and persist the entire farm's sustainability score for this season/year
  try {
    const { calculateAndPersistScore } = require('./sustainabilityScore.service');
    await calculateAndPersistScore(existingRecord.farm_id, updatedSeasonId, updatedYear);
  } catch (e) {
    console.warn('Dynamic sustainability score update notification:', e.message);
  }

  return updatedRecord;
};

module.exports = {
  createCropRecord,
  getCropRecordsByFarm,
  getCropRecordById,
  updateCropRecord
};
