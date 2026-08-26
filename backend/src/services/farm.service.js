const { query } = require('../db');

/**
 * Helper to fetch authenticated user's current geographic assignment
 */
async function getUserVillageAssignment(userId) {
  const result = await query('SELECT id, role, village_id FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
}

/**
 * Creates a new farm in the Village Head's assigned village
 */
const createFarm = async (userId, { name, owner_name, village_id, total_land_area_hectares }) => {
  const user = await getUserVillageAssignment(userId);

  if (!user.village_id) {
    const error = new Error('Access forbidden: Village Head is not assigned to any village');
    error.statusCode = 403;
    throw error;
  }

  // 1. Validate village_id
  if (village_id === undefined || village_id === null || isNaN(parseInt(village_id, 10))) {
    const error = new Error('Valid village_id is required');
    error.statusCode = 400;
    throw error;
  }

  const targetVillageId = parseInt(village_id, 10);

  // 2. Enforce geographic authority (Village Head can only create in their own village)
  if (targetVillageId !== user.village_id) {
    const error = new Error('Access forbidden: You may only create farms in your assigned village');
    error.statusCode = 403;
    throw error;
  }

  // 3. Validate name
  if (!name || typeof name !== 'string' || !name.trim()) {
    const error = new Error('Farm name is required');
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate owner_name
  if (owner_name !== undefined && owner_name !== null && typeof owner_name !== 'string') {
    const error = new Error('Owner name must be a string');
    error.statusCode = 400;
    throw error;
  }

  // 5. Validate total_land_area_hectares
  if (
    total_land_area_hectares === undefined ||
    total_land_area_hectares === null ||
    isNaN(parseFloat(total_land_area_hectares)) ||
    parseFloat(total_land_area_hectares) <= 0
  ) {
    const error = new Error('Total land area must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const cleanOwnerName = owner_name ? owner_name.trim() : null;
  const cleanLandArea = parseFloat(total_land_area_hectares);

  // 6. Insert farm with parameterized query
  const result = await query(
    `INSERT INTO farms (name, owner_name, village_id, total_land_area_hectares)
     VALUES ($1, $2, $3, $4)
     RETURNING farm_id, name, owner_name, village_id, total_land_area_hectares, created_at`,
    [name.trim(), cleanOwnerName, targetVillageId, cleanLandArea]
  );

  return result.rows[0];
};

/**
 * Returns all farms strictly belonging to the Village Head's assigned village
 */
const getFarms = async (userId) => {
  const user = await getUserVillageAssignment(userId);

  if (!user.village_id) {
    const error = new Error('Access forbidden: Village Head is not assigned to any village');
    error.statusCode = 403;
    throw error;
  }

  const result = await query(
    `SELECT f.farm_id, f.name, f.owner_name, f.village_id, f.total_land_area_hectares, f.created_at,
            v.name AS village_name, d.name AS district_name, s.name AS state_name
     FROM farms f
     JOIN villages v ON v.village_id = f.village_id
     JOIN districts d ON d.district_id = v.district_id
     JOIN states s ON s.state_id = d.state_id
     WHERE f.village_id = $1
     ORDER BY f.farm_id ASC`,
    [user.village_id]
  );

  return result.rows;
};

/**
 * Returns a single farm if it exists and belongs to the Village Head's assigned village
 */
const getFarmById = async (userId, farmId) => {
  const user = await getUserVillageAssignment(userId);

  if (!user.village_id) {
    const error = new Error('Access forbidden: Village Head is not assigned to any village');
    error.statusCode = 403;
    throw error;
  }

  const parsedFarmId = parseInt(farmId, 10);
  if (isNaN(parsedFarmId)) {
    const error = new Error('Valid numeric farm id is required');
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `SELECT f.farm_id, f.name, f.owner_name, f.village_id, f.total_land_area_hectares, f.created_at,
            v.name AS village_name, d.name AS district_name, s.name AS state_name
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

  const farm = result.rows[0];

  // Enforce geographic authorization to prevent IDOR
  if (farm.village_id !== user.village_id) {
    const error = new Error('Access forbidden: You do not have authority over farms outside your assigned village');
    error.statusCode = 403;
    throw error;
  }

  return farm;
};

/**
 * Updates an existing farm belonging to the Village Head's assigned village
 */
const updateFarm = async (userId, farmId, { name, owner_name, village_id, total_land_area_hectares }) => {
  const user = await getUserVillageAssignment(userId);

  if (!user.village_id) {
    const error = new Error('Access forbidden: Village Head is not assigned to any village');
    error.statusCode = 403;
    throw error;
  }

  const parsedFarmId = parseInt(farmId, 10);
  if (isNaN(parsedFarmId)) {
    const error = new Error('Valid numeric farm id is required');
    error.statusCode = 400;
    throw error;
  }

  // 1. Fetch existing farm to verify existence and authorization
  const existingRes = await query(
    'SELECT farm_id, name, owner_name, village_id, total_land_area_hectares FROM farms WHERE farm_id = $1',
    [parsedFarmId]
  );

  if (existingRes.rows.length === 0) {
    const error = new Error('Farm not found');
    error.statusCode = 404;
    throw error;
  }

  const existingFarm = existingRes.rows[0];

  // 2. Geographic authorization check
  if (existingFarm.village_id !== user.village_id) {
    const error = new Error('Access forbidden: You do not have authority over farms outside your assigned village');
    error.statusCode = 403;
    throw error;
  }

  // 3. Immutability of village_id check
  if (
    village_id !== undefined &&
    village_id !== null &&
    parseInt(village_id, 10) !== existingFarm.village_id
  ) {
    const error = new Error('Farm village assignment is immutable');
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate input updates
  let updatedName = existingFarm.name;
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      const error = new Error('Farm name cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    updatedName = name.trim();
  }

  let updatedOwnerName = existingFarm.owner_name;
  if (owner_name !== undefined) {
    if (owner_name !== null && typeof owner_name !== 'string') {
      const error = new Error('Owner name must be a string');
      error.statusCode = 400;
      throw error;
    }
    updatedOwnerName = owner_name ? owner_name.trim() : null;
  }

  let updatedLandArea = existingFarm.total_land_area_hectares;
  if (total_land_area_hectares !== undefined) {
    if (
      total_land_area_hectares === null ||
      isNaN(parseFloat(total_land_area_hectares)) ||
      parseFloat(total_land_area_hectares) <= 0
    ) {
      const error = new Error('Total land area must be a positive number');
      error.statusCode = 400;
      throw error;
    }
    updatedLandArea = parseFloat(total_land_area_hectares);
  }

  // 5. Update farm using parameterized query
  const result = await query(
    `UPDATE farms
     SET name = $1, owner_name = $2, total_land_area_hectares = $3
     WHERE farm_id = $4
     RETURNING farm_id, name, owner_name, village_id, total_land_area_hectares, created_at`,
    [updatedName, updatedOwnerName, updatedLandArea, parsedFarmId]
  );

  return result.rows[0];
};

module.exports = {
  createFarm,
  getFarms,
  getFarmById,
  updateFarm
};
