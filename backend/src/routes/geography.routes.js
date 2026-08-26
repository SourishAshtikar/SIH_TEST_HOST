const express = require('express');
const router = express.Router();
const geographyController = require('../controllers/geography.controller');

router.get('/states', geographyController.getStates);
router.get('/districts', geographyController.getDistricts);
router.get('/villages', geographyController.getVillages);

module.exports = router;
