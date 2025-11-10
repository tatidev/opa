const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

// Mount all authentication routes from controller
router.use('/', authController);

module.exports = router; 