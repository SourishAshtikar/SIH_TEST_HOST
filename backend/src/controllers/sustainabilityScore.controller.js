const sustainabilityScoreService = require('../services/sustainabilityScore.service');
const { query } = require('../db');

/**
 * Helper to check geographic authorization on a specific farm.
 */
async function verifyFarmAccess(user, farmId) {
  const farmRes = await query(`
    SELECT f.farm_id, f.village_id, v.district_id
    FROM farms f
    JOIN villages v ON f.village_id = v.village_id
    WHERE f.farm_id = $1
  `, [farmId]);

  if (farmRes.rows.length === 0) {
    const error = new Error(`Farm with ID ${farmId} not found`);
    error.statusCode = 404;
    throw error;
  }

  const farm = farmRes.rows[0];

  // Fetch live user with geographic assignment
  const userRes = await query('SELECT id, role, village_id, district_id FROM users WHERE id = $1', [user.id]);
  const userGeo = userRes.rows[0];

  if (!userGeo) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (userGeo.role === 'VILLAGE_HEAD') {
    if (userGeo.village_id === null || farm.village_id !== userGeo.village_id) {
      const error = new Error('Access denied: You can only access sustainability scores for farms in your assigned village');
      error.statusCode = 403;
      throw error;
    }
  } else if (userGeo.role === 'AUDITOR') {
    if (userGeo.district_id === null || farm.district_id !== userGeo.district_id) {
      const error = new Error('Access denied: You can only access sustainability scores for farms in your assigned district');
      error.statusCode = 403;
      throw error;
    }
  }

  return { farm, userGeo };
}

const calculateScore = async (req, res) => {
  try {
    const farmId = parseInt(req.params.farm_id, 10);
    const { season_id, agricultural_year } = req.body || {};

    if (isNaN(farmId) || !season_id || !agricultural_year) {
      return res.status(400).json({
        status: 'error',
        message: 'farm_id, season_id, and agricultural_year are required'
      });
    }

    // Geographic RBAC verification
    await verifyFarmAccess(req.user, farmId);

    // Calculate & persist (ignores any client-provided fake score or priority)
    const result = await sustainabilityScoreService.calculateAndPersistScore(
      farmId,
      parseInt(season_id, 10),
      String(agricultural_year).trim()
    );

    return res.status(200).json({
      status: 'success',
      message: 'Sustainability score calculated and persisted successfully',
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while calculating the sustainability score'
    });
  }
};

const getScore = async (req, res) => {
  try {
    const farmId = parseInt(req.params.farm_id, 10);
    const seasonId = req.query.seasonId ? parseInt(req.query.seasonId, 10) : null;
    const agriculturalYear = req.query.agriculturalYear ? String(req.query.agriculturalYear).trim() : null;

    if (isNaN(farmId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid farm_id parameter'
      });
    }

    // Geographic RBAC verification
    await verifyFarmAccess(req.user, farmId);

    const result = await sustainabilityScoreService.getScoreByFarm(farmId, seasonId, agriculturalYear);

    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: 'Sustainability score not found for this farm and season'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving the sustainability score'
    });
  }
};

const listScores = async (req, res) => {
  try {
    const filters = {};

    const userRes = await query('SELECT id, role, village_id, district_id FROM users WHERE id = $1', [req.user.id]);
    const userGeo = userRes.rows[0];

    if (userGeo && userGeo.role === 'VILLAGE_HEAD') {
      filters.villageId = userGeo.village_id;
    } else if (userGeo && userGeo.role === 'AUDITOR') {
      filters.districtId = userGeo.district_id;
    } else {
      if (req.query.districtId) filters.districtId = parseInt(req.query.districtId, 10);
      if (req.query.villageId) filters.villageId = parseInt(req.query.villageId, 10);
    }

    if (req.query.seasonId) filters.seasonId = parseInt(req.query.seasonId, 10);
    if (req.query.agriculturalYear) filters.agriculturalYear = String(req.query.agriculturalYear).trim();

    const scores = await sustainabilityScoreService.listScores(filters);

    return res.status(200).json({
      status: 'success',
      data: {
        scores
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while listing sustainability scores'
    });
  }
};

module.exports = {
  calculateScore,
  getScore,
  listScores
};
