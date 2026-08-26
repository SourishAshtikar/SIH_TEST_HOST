const express = require('express');
const router = express.Router();
const cropRecordController = require('../controllers/cropRecord.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All crop record routes require authentication
router.use(authenticateToken);

// Create and update routes strictly require VILLAGE_HEAD role
router.post('/farms/:farm_id/crop-records', requireRole('VILLAGE_HEAD'), cropRecordController.createCropRecord);
router.put('/crop-records/:id', requireRole('VILLAGE_HEAD'), cropRecordController.updateCropRecord);

// Read routes allow VILLAGE_HEAD (village scope) and AUDITOR (district scope)
router.get('/farms/:farm_id/crop-records', cropRecordController.getCropRecordsByFarm);
router.get('/crop-records/:id', cropRecordController.getCropRecordById);

module.exports = router;
