const express = require('express');
const router = express.Router();
const sustainabilityScoreController = require('../controllers/sustainabilityScore.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All sustainability score endpoints require authentication
router.use(authenticateToken);

// 1. Calculate & Persist Score for a farm/season/year (VILLAGE_HEAD, AUDITOR, ADMIN)
router.post(
  '/farms/:farm_id/sustainability-score/calculate',
  sustainabilityScoreController.calculateScore
);

// 2. Retrieve Score for a farm/season/year
router.get(
  '/farms/:farm_id/sustainability-score',
  sustainabilityScoreController.getScore
);

// 3. List scores for Government, Auditor, or Village Head dashboards
router.get(
  '/sustainability-scores',
  sustainabilityScoreController.listScores
);

module.exports = router;
