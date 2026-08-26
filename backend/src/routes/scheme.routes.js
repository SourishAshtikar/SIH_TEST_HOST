const express = require('express');
const router = express.Router();
const schemeController = require('../controllers/scheme.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All scheme routes require authentication
router.use(authenticateToken);

// Read endpoints: accessible to all authenticated roles
router.get('/', schemeController.getSchemes);
router.get('/:id', schemeController.getSchemeById);

// Write endpoints: strictly restricted to ADMIN role
router.post('/', requireRole('ADMIN'), schemeController.createScheme);
router.put('/:id', requireRole('ADMIN'), schemeController.updateScheme);
router.delete('/:id', requireRole('ADMIN'), schemeController.deleteScheme);

module.exports = router;
