const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farm.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All farm routes require authentication and VILLAGE_HEAD role
router.use(authenticateToken);
router.use(requireRole('VILLAGE_HEAD'));

router.post('/', farmController.createFarm);
router.get('/', farmController.getFarms);
router.get('/:id', farmController.getFarmById);
router.put('/:id', farmController.updateFarm);

module.exports = router;
