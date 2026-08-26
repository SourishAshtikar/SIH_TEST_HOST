const express = require('express');
const router = express.Router();
const agricultureController = require('../controllers/agriculture.controller');

router.get('/seasons', agricultureController.getSeasons);
router.get('/crops', agricultureController.getCrops);
router.get('/irrigation-methods', agricultureController.getIrrigationMethods);

module.exports = router;
