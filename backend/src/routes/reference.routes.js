const express = require('express');
const referenceController = require('../controllers/reference.controller');

const router = express.Router();

// Public, read-only reference catalogue used by recommendation inputs.
router.get('/recommendation-options', referenceController.getRecommendationReferenceData);

module.exports = router;
