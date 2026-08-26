const express = require('express');
const router = express.Router();
const groundwaterAssessmentController = require('../controllers/groundwaterAssessment.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Protect all routes with JWT token verification
router.use(authenticateToken);

router.get('/years', groundwaterAssessmentController.getYears);
router.get('/', groundwaterAssessmentController.getAssessments);
router.get('/details', groundwaterAssessmentController.getDetails);

module.exports = router;
