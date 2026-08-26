const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendation.controller');

router.post('/recommendations', recommendationController.getRecommendation);

module.exports = router;
