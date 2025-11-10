/**
 * NetSuite CSV Import Controller
 * Handles automated import of OPMS CSV exports to NetSuite
 */

const CsvToNetSuiteTransformService = require('../services/csvToNetSuiteTransformService');
const NetSuiteRestletService = require('../services/netsuiteRestletService');
const ImportJobModel = require('../models/ImportJobModel');
const ImportItemModel = require('../models/ImportItemModel');
const CsvImportProgressService = require('../services/csvImportProgressService');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Generate UUID using crypto (Node.js built-in)
function generateUuid() {
    return crypto.randomUUID();
}

class NetSuiteCsvImportController {
    constructor() {
        this.transformService = new CsvToNetSuiteTransformService();
        this.restletService = NetSuiteRestletService;
        this.importJobModel = new ImportJobModel();
        this.importItemModel = new ImportItemModel();
        this.progressService = new CsvImportProgressService();
    }

    /**
     * Handle OPMS CSV file upload and create NetSuite import job
     * POST /api/netsuite/import/csv
     */
    async uploadCsvForNetSuiteImport(req, res) {
        try {
            // Validate file upload
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No CSV file provided'
                });
            }

            logger.info('NetSuite CSV import request received', {
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });

            // Validate file type
            if (req.file.mimetype !== 'text/csv' && !req.file.originalname.endsWith('.csv')) {
                return res.status(400).json({
                    success: false,
                    error: 'File must be a CSV file'
                });
            }

            // Parse request options
            const options = req.body.options ? JSON.parse(req.body.options) : {};
            const {
                batchSize = 10,
                delayMs = 2000,
                dryRun = false
            } = options;

            // Save uploaded file temporarily
            const tempFilePath = `/tmp/netsuite-import-${Date.now()}.csv`;
            require('fs').writeFileSync(tempFilePath, req.file.buffer);

            // Transform CSV to RESTlet payloads
            const transformResult = await this.transformService.transformCsvToRestletPayloads(tempFilePath);
            
            if (!transformResult.success) {
                return res.status(400).json({
                    success: false,
                    error: 'CSV transformation failed',
                    details: transformResult.error
                });
            }

            if (transformResult.transformedItems.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid items found in CSV for NetSuite import',
                    details: transformResult.errors
                });
            }

            // If dry run, return transformation preview
            if (dryRun) {
                const stats = this.transformService.getTransformationStats(transformResult);
                return res.json({
                    success: true,
                    dryRun: true,
                    message: 'CSV transformation preview completed',
                    data: {
                        filename: req.file.originalname,
                        stats: stats,
                        samplePayload: transformResult.transformedItems[0]?.payload,
                        errors: transformResult.errors.slice(0, 10) // First 10 errors
                    }
                });
            }

            // Create import job
            const jobUuid = generateUuid();
            const jobData = {
                job_uuid: jobUuid,
                original_filename: req.file.originalname,
                total_items: transformResult.transformedItems.length,
                created_by_user_id: req.user?.id || null // If authentication is available
            };

            const jobRecord = await this.importJobModel.create(jobData);
            const jobId = jobRecord.id;
            logger.info(`Created NetSuite import job ${jobId}`, { jobUuid, totalItems: jobData.total_items });

            // Create import items
            const importItemsData = transformResult.transformedItems.map(item => ({
                opms_item_id: item.payload.custitem_opms_item_id,
                opms_item_code: item.payload.itemId
            }));

            await this.importItemModel.createItems(jobId, importItemsData);
            logger.info(`Created ${importItemsData.length} import item records`);

            // Start progress tracking
            this.progressService.startJobTracking(jobId, jobData);

            // Start async processing (don't await - let it run in background)
            this.processNetSuiteImportJobAsync(jobId, jobUuid, transformResult.transformedItems, {
                batchSize,
                delayMs,
                tempFilePath
            }).catch(error => {
                logger.error(`Async NetSuite import job ${jobId} failed:`, error);
                // Mark job as failed in database
                this.importJobModel.updateJobStatus(jobUuid, 'failed', {
                    completed_at: new Date(),
                    error_message: error.message
                }).catch(dbError => {
                    logger.error(`Failed to update job ${jobId} status:`, dbError);
                });
            });

            // Return job creation response
            res.status(201).json({
                success: true,
                message: 'NetSuite import job created successfully',
                data: {
                    jobId: jobId,
                    jobUuid: jobUuid,
                    totalItems: transformResult.transformedItems.length,
                    estimatedTime: this.estimateProcessingTime(transformResult.transformedItems.length, batchSize, delayMs),
                    status: 'processing',
                    transformationStats: this.transformService.getTransformationStats(transformResult)
                }
            });

        } catch (error) {
            logger.error('NetSuite CSV import failed:', error);
            res.status(500).json({
                success: false,
                error: 'NetSuite CSV import failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Process NetSuite import job asynchronously
     * @param {number} jobId - Import job ID
     * @param {Array} transformedItems - Array of transformed items
     * @param {Object} options - Processing options
     */
    async processNetSuiteImportJobAsync(jobId, jobUuid, transformedItems, options) {
        const { batchSize, delayMs, tempFilePath } = options;
        
        try {
            logger.info(`Starting async NetSuite import processing for job ${jobId}`);
            
            // Update job status to processing
            await this.importJobModel.updateJobStatus(jobUuid, 'processing', { started_at: new Date() });

            // Process items in batches using existing RESTlet service
            const results = await this.restletService.createItemsBulk(
                transformedItems.map(item => item.payload),
                { batchSize, delay: delayMs }
            );

            // Update progress and individual item statuses
            for (let i = 0; i < results.results.length; i++) {
                const result = results.results[i];
                const transformedItem = transformedItems[i];
                
                if (result.success) {
                    await this.importItemModel.updateByJobAndRow(
                        jobId, 
                        transformedItem.rowIndex, 
                        { 
                            status: 'success',
                            netsuite_item_id: result.result.id,
                            succeeded_at: new Date()
                        }
                    );
                } else {
                    await this.importItemModel.updateByJobAndRow(
                        jobId,
                        transformedItem.rowIndex,
                        { 
                            status: 'failed_permanent',
                            last_error_message: result.error,
                            last_attempted_at: new Date()
                        }
                    );
                }

                // Update job progress
                this.progressService.updateJobProgress(jobId, {
                    processedItems: i + 1,
                    succeededItems: results.results.slice(0, i + 1).filter(r => r.success).length,
                    failedItems: results.results.slice(0, i + 1).filter(r => !r.success).length
                });
            }

            // Complete the job
            await this.importJobModel.updateJobStatus(jobUuid, 'completed', {
                completed_at: new Date(),
                items_processed: results.total,
                items_succeeded: results.successful,
                items_failed_permanent: results.failed
            });

            this.progressService.completeJob(jobId, {
                totalProcessed: results.total,
                successful: results.successful,
                failed: results.failed
            });

            logger.info(`NetSuite import job ${jobId} completed`, {
                total: results.total,
                successful: results.successful,
                failed: results.failed
            });

        } catch (error) {
            logger.error(`NetSuite import job ${jobId} failed:`, error);
            
            // Mark job as failed
            await this.importJobModel.updateJobStatus(jobUuid, 'failed', {
                completed_at: new Date(),
                error_message: error.message
            });

            this.progressService.failJob(jobId, error.message);

        } finally {
            // Clean up temporary file
            try {
                require('fs').unlinkSync(tempFilePath);
                logger.info(`Cleaned up temporary file: ${tempFilePath}`);
            } catch (cleanupError) {
                logger.warn(`Failed to clean up temporary file: ${tempFilePath}`, cleanupError);
            }
        }
    }

    /**
     * Get NetSuite import job status
     * GET /api/netsuite/import/jobs/:jobId
     */
    async getNetSuiteImportJobStatus(req, res) {
        try {
            const jobId = parseInt(req.params.jobId);
            
            if (isNaN(jobId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid job ID'
                });
            }

            const job = await this.importJobModel.findById(jobId);
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Import job not found'
                });
            }

            // Get progress from progress service
            const progress = this.progressService.getJobProgress(jobId);

            res.json({
                success: true,
                data: {
                    jobId: job.id,
                    jobUuid: job.job_uuid,
                    status: job.status,
                    filename: job.original_filename,
                    totalItems: job.total_items,
                    processedItems: job.items_processed || 0,
                    succeededItems: job.items_succeeded || 0,
                    failedItems: job.items_failed_permanent || 0,
                    progress: progress,
                    createdAt: job.created_at,
                    startedAt: job.started_at,
                    completedAt: job.completed_at
                }
            });

        } catch (error) {
            logger.error('Failed to get NetSuite import job status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve job status',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Estimate processing time based on items and batch settings
     * @param {number} itemCount - Number of items to process
     * @param {number} batchSize - Items per batch
     * @param {number} delayMs - Delay between batches
     * @returns {string} Estimated time string
     */
    estimateProcessingTime(itemCount, batchSize, delayMs) {
        const batches = Math.ceil(itemCount / batchSize);
        const totalDelayMs = (batches - 1) * delayMs;
        const processingTimeMs = itemCount * 1000; // Assume 1 second per item processing
        const totalMs = totalDelayMs + processingTimeMs;
        
        const minutes = Math.ceil(totalMs / 60000);
        
        if (minutes < 1) {
            return 'Less than 1 minute';
        } else if (minutes < 60) {
            return `${minutes} minutes`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        }
    }
}

module.exports = NetSuiteCsvImportController;
