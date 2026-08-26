const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes (requires valid JWT)
router.get('/me', authenticateToken, authController.getMe);

// Role-protected test route (requires valid JWT + ADMIN role)
router.get('/admin-test', authenticateToken, requireRole('ADMIN'), authController.adminTest);

module.exports = router;
