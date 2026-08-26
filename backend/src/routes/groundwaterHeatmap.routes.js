const express = require('express');
const router = express.Router();
const groundwaterHeatmapController = require('../controllers/groundwaterHeatmap.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

router.get('/predictions', groundwaterHeatmapController.getHeatmapPredictions);
router.get('/heatmap', groundwaterHeatmapController.getHeatmapPredictions);

module.exports = router;
