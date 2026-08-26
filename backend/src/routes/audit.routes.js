const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// All audit routes require authentication
router.use(authenticateToken);

// Create and Update routes are strictly restricted to AUDITOR role
router.post('/', requireRole('AUDITOR'), auditController.createAudit);
router.put('/:id', requireRole('AUDITOR'), auditController.updateAudit);

// Read routes allow AUDITOR and VILLAGE_HEAD within their respective geographic scopes
router.get('/', auditController.getAudits);
router.get('/:id', auditController.getAuditById);

module.exports = router;
