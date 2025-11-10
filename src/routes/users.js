const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');

/**
 * @swagger
 * tags:
 *   name: User Management
 *   description: User management endpoints
 */

// Mount all user routes from controller
router.use('/', userController);

module.exports = router; 