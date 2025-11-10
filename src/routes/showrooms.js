const express = require('express');
const router = express.Router();
const showroomController = require('../controllers/ShowroomController');

/**
 * @swagger
 * tags:
 *   name: Showroom Management
 *   description: Showroom management endpoints
 */

// Mount all showroom routes from controller
router.use('/', showroomController);

module.exports = router; 