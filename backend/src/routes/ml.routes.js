const express = require('express');
const mlController = require('../controllers/ml.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected route for ML prediction (accessible to any authenticated user for now)
router.post('/predict', authenticateToken, mlController.getPrediction);

module.exports = router;
