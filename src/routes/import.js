/**
 * CSV Import Routes
 * Handles CSV file uploads and import job management
 */

const express = require('express');
const multer = require('multer');
const CsvImportController = require('../controllers/CsvImportController');
const { authenticate: auth } = require('../middleware/auth');
const { strictLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// SECURITY: Apply strict rate limiting to all import routes (100 req/15min)
router.use(strictLimiter);

// Configure multer for CSV file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Accept CSV files and files with .csv extension
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

// Initialize controller
const csvImportController = new CsvImportController();

// Function to inject database connection into controller
const injectDatabase = (db) => {
    csvImportController.setDatabase(db);
};

// Export the inject function for use in main app
module.exports.injectDatabase = injectDatabase;

/**
 * @swagger
 * /api/import/csv:
 *   post:
 *     summary: Upload CSV file for import
 *     description: Upload a CSV file to create an import job for OPMS data. Item codes must use ####-#### format.
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file to upload
 *     responses:
 *       200:
 *         description: CSV import job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: CSV import job created successfully
 *                 job:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     uuid:
 *                       type: string
 *                       example: job_1234567890_abc123
 *                     status:
 *                       type: string
 *                       example: pending
 *                     totalItems:
 *                       type: integer
 *                       example: 100
 *                     validItems:
 *                       type: integer
 *                       example: 95
 *                     failedItems:
 *                       type: integer
 *                       example: 5
 *                 validation:
 *                   type: object
 *                   properties:
 *                     totalRows:
 *                       type: integer
 *                       example: 100
 *                     validRows:
 *                       type: integer
 *                       example: 95
 *                     invalidRows:
 *                       type: integer
 *                       example: 5
 *                     warnings:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Row 3: Missing color information"]
 *       400:
 *         description: Bad request - validation failed or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: CSV validation failed
 *                 validation:
 *                   type: object
 *                   properties:
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Row 1: Invalid Item Code \"ABC123\" - FIX: Must use new format ####-#### (4 digits, dash, 4 digits). Examples: \"1354-6543\", \"2001-5678\", \"9999-0001\""]
 *                     fixGuidance:
 *                       type: object
 *                       properties:
 *                         examples:
 *                           type: object
 *                           properties:
 *                             Item Code:
 *                               type: string
 *                               example: "1354-6543, 2001-5678, 9999-0001"
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/csv', auth, upload.single('file'), (req, res) => csvImportController.uploadCsv(req, res));

/**
 * @swagger
 * /api/import/csv/template:
 *   get:
 *     summary: Download CSV import template
 *     description: Get a CSV template with headers and example data for OPMS imports
 *     tags: [Import]
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       500:
 *         description: Internal server error
 */
router.get('/csv/template', (req, res) => csvImportController.getCsvTemplate(req, res));

/**
 * @swagger
 * /api/import/jobs:
 *   get:
 *     summary: List import jobs
 *     description: Get a list of all CSV import jobs with optional filtering
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *         description: Filter jobs by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Maximum number of jobs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of jobs to skip
 *     responses:
 *       200:
 *         description: List of import jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImportJob'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       example: 50
 *                     offset:
 *                       type: integer
 *                       example: 0
 *                     total:
 *                       type: integer
 *                       example: 25
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/jobs', auth, (req, res) => csvImportController.listImportJobs(req, res));

/**
 * @swagger
 * /api/import/jobs/{jobId}:
 *   get:
 *     summary: Get import job status
 *     description: Get the current status and progress of a specific import job
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Import job ID
 *     responses:
 *       200:
 *         description: Import job status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 job:
 *                   $ref: '#/components/schemas/ImportJob'
 *                 status:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     pending:
 *                       type: integer
 *                       example: 20
 *                     processing:
 *                       type: integer
 *                       example: 5
 *                     success:
 *                       type: integer
 *                       example: 70
 *                     failed_retryable:
 *                       type: integer
 *                       example: 3
 *                     failed_permanent:
 *                       type: integer
 *                       example: 2
 *       404:
 *         description: Import job not found
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/jobs/:jobId', auth, (req, res) => csvImportController.getImportJobStatus(req, res));

/**
 * @swagger
 * /api/import/jobs/{jobId}/details:
 *   get:
 *     summary: Get import job details
 *     description: Get detailed information about a specific import job including all items
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Import job ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *         description: Maximum number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: Import job details with items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 job:
 *                   $ref: '#/components/schemas/ImportJob'
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImportItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       example: 100
 *                     offset:
 *                       type: integer
 *                       example: 0
 *                     total:
 *                       type: integer
 *                       example: 100
 *       404:
 *         description: Import job not found
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/jobs/:jobId/details', auth, (req, res) => csvImportController.getImportJobDetails(req, res));

/**
 * @swagger
 * /api/import/jobs/{jobId}/cancel:
 *   post:
 *     summary: Cancel import job
 *     description: Cancel a running or pending import job
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Import job ID
 *     responses:
 *       200:
 *         description: Import job cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Import job cancelled successfully
 *                 job:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     status:
 *                       type: string
 *                       example: cancelled
 *       400:
 *         description: Bad request - cannot cancel completed or already cancelled job
 *       404:
 *         description: Import job not found
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/jobs/:jobId/cancel', auth, (req, res) => csvImportController.cancelImportJob(req, res));

/**
 * @swagger
 * components:
 *   schemas:
 *     ImportJob:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         job_uuid:
 *           type: string
 *           example: job_1234567890_abc123
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *           example: processing
 *         original_filename:
 *           type: string
 *           example: opms-import.csv
 *         total_items:
 *           type: integer
 *           example: 100
 *         items_processed:
 *           type: integer
 *           example: 50
 *         items_succeeded:
 *           type: integer
 *           example: 45
 *         items_failed_permanent:
 *           type: integer
 *           example: 3
 *         items_failed_retryable:
 *           type: integer
 *           example: 2
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2025-01-15T10:30:00Z
 *         started_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2025-01-15T10:30:05Z
 *         completed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2025-01-15T10:35:00Z
 *     
 *     ImportItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         opms_item_code:
 *           type: string
 *           pattern: ^\d{4}-\d{4}$
 *           description: Item code in format ####-#### (required for CSV imports)
 *           example: 1354-6543
 *         status:
 *           type: string
 *           enum: [pending, processing, success, failed_retryable, failed_permanent]
 *           example: success
 *         csv_row_number:
 *           type: integer
 *           example: 1
 *         last_error_message:
 *           type: string
 *           nullable: true
 *           example: Validation failed
 *         first_attempted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2025-01-15T10:30:05Z
 *         last_attempted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2025-01-15T10:30:10Z
 *         succeeded_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2025-01-15T10:30:10Z
 */

module.exports = {
    router: router,
    injectDatabase: injectDatabase
};
