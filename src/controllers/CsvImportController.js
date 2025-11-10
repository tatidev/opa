/**
 * CSV Import Controller
 * Handles CSV file uploads and import job creation
 */

const CsvImportService = require('../services/csvImportService');
const CsvDataTransformationService = require('../services/csvDataTransformationService');
const ImportJobModel = require('../models/ImportJobModel');
const ImportItemModel = require('../models/ImportItemModel');
const ImportJobProcessor = require('../services/importJobProcessor');
const logger = require('../utils/logger');

class CsvImportController {
    constructor() {
        this.csvService = new CsvImportService();
        this.transformationService = new CsvDataTransformationService();
        this.importJobModel = new ImportJobModel();
        this.importItemModel = new ImportItemModel();
        this.jobProcessor = new ImportJobProcessor();
    }

    /**
     * Set database connection for all services
     * @param {Object} db - Database connection
     */
    setDatabase(db) {
        this.importJobModel.db = db;
        this.importItemModel.db = db;
        this.jobProcessor.setDatabase(db);
    }

    /**
     * Process import job asynchronously
     * @param {number} jobId - Import job ID
     * @param {Array} transformedData - Transformed CSV data
     */
    async processJobAsync(jobId, transformedData) {
        try {
            logger.info(`Starting asynchronous processing of job ${jobId}`);
            
            const results = await this.jobProcessor.processJob(jobId, transformedData);
            
            logger.info(`Completed processing job ${jobId}`, {
                jobId: jobId,
                totalRows: results.totalRows,
                successfulRows: results.successfulRows,
                failedRows: results.failedRows
            });
            
        } catch (error) {
            logger.error(`Failed to process job ${jobId} asynchronously`, error);
            
            // Update job status to failed
            try {
                await this.importJobModel.update(jobId, {
                    status: 'failed',
                    completed_at: new Date()
                });
            } catch (updateError) {
                logger.error(`Failed to update job ${jobId} status to failed`, updateError);
            }
        }
    }

    /**
     * Handle CSV file upload and create import job
     * POST /api/import/csv
     */
    async uploadCsv(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No CSV file provided'
                });
            }

            logger.info('CSV import request received', {
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

            // Parse CSV data
            const csvData = await this.csvService.parseCsvBuffer(req.file.buffer);
            
            if (csvData.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'CSV file is empty or contains no data rows'
                });
            }

            // Validate CSV data
            const validation = this.csvService.validateCsvData(csvData);
            
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'CSV validation failed',
                    validation: validation
                });
            }

            // Create import job
            const jobData = {
                job_uuid: this.generateJobUuid(),
                original_filename: req.file.originalname,
                total_items: csvData.length,
                status: 'pending',
                created_by_user_id: req.user?.id || null
            };

            const importJob = await this.importJobModel.create(jobData);

            // Transform CSV data to database operations
            const transformedData = [];
            for (let i = 0; i < csvData.length; i++) {
                const row = csvData[i];
                const transformed = this.transformationService.transformCsvRow(row, i + 1);
                transformedData.push(transformed);
            }

            // Create import items for tracking
            const importItems = [];
            for (let i = 0; i < csvData.length; i++) {
                const row = csvData[i];
                const transformed = transformedData[i];
                
                const itemData = {
                    job_id: importJob.id,
                    opms_item_id: null, // Will be set after import
                    opms_item_code: row['Item Id (Opuzen Code)'] || '',
                    csv_row_number: i + 1,
                    status: transformed.errors.length > 0 ? 'failed_permanent' : 'pending',
                    last_error_message: transformed.errors.length > 0 ? transformed.errors.join('; ') : null
                };

                importItems.push(itemData);
            }

            // Bulk create import items
            if (importItems.length > 0) {
                await this.importItemModel.bulkCreate(importItems);
            }

                        // Update job with initial counts
            const failedCount = transformedData.filter(t => t.errors.length > 0).length;
            const pendingCount = csvData.length - failedCount;

            await this.importJobModel.update(importJob.id, {
                items_processed: 0,
                items_succeeded: 0,
                items_failed_permanent: failedCount,
                items_failed_retryable: 0
            });

            logger.info('CSV import job created successfully, starting processing', {
                jobId: importJob.id,
                totalItems: csvData.length,
                validItems: pendingCount,
                failedItems: failedCount
            });

            // Start processing the job asynchronously
            this.processJobAsync(importJob.id, transformedData);

            res.json({
                success: true,
                message: 'CSV import job created and processing started',
                job: {
                    id: importJob.id,
                    uuid: importJob.job_uuid,
                    status: 'processing',
                    totalItems: csvData.length,
                    validItems: pendingCount,
                    failedItems: failedCount
                },
                validation: {
                    totalRows: validation.summary.totalRows,
                    validRows: validation.summary.validRows,
                    invalidRows: validation.summary.invalidRows,
                    warnings: validation.warnings
                }
            });

        } catch (error) {
            logger.error('CSV import failed', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during CSV import',
                details: error.message
            });
        }
    }

    /**
     * Get CSV import template
     * GET /api/import/csv/template
     */
    async getCsvTemplate(req, res) {
        try {
            const template = this.csvService.getCsvTemplate();
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="opms-import-template.csv"');
            res.send(template);

        } catch (error) {
            logger.error('Failed to generate CSV template', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate CSV template'
            });
        }
    }

    /**
     * Get import job status
     * GET /api/import/jobs/:jobId
     */
    async getImportJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            
            const job = await this.importJobModel.findById(jobId);
            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Import job not found'
                });
            }

            // Get job items for detailed status
            const items = await this.importItemModel.findByJobId(jobId);
            
            const statusSummary = {
                total: items.length,
                pending: items.filter(item => item.status === 'pending').length,
                processing: items.filter(item => item.status === 'processing').length,
                success: items.filter(item => item.status === 'success').length,
                failed_retryable: items.filter(item => item.status === 'failed_retryable').length,
                failed_permanent: items.filter(item => item.status === 'failed_permanent').length
            };

            res.json({
                success: true,
                job: {
                    id: job.id,
                    uuid: job.job_uuid,
                    status: job.status,
                    original_filename: job.original_filename,
                    total_items: job.total_items,
                    items_processed: job.items_processed,
                    items_succeeded: job.items_succeeded,
                    items_failed_permanent: job.items_failed_permanent,
                    items_failed_retryable: job.items_failed_retryable,
                    created_at: job.created_at,
                    started_at: job.started_at,
                    completed_at: job.completed_at
                },
                status: statusSummary
            });

        } catch (error) {
            logger.error('Failed to get import job status', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get import job status'
            });
        }
    }

    /**
     * List all import jobs
     * GET /api/import/jobs
     */
    async listImportJobs(req, res) {
        try {
            const { status, limit = 50, offset = 0 } = req.query;
            
            const jobs = await this.importJobModel.findAll({
                status: status || undefined,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                jobs: jobs,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: jobs.length
                }
            });

        } catch (error) {
            logger.error('Failed to list import jobs', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list import jobs'
            });
        }
    }

    /**
     * Cancel import job
     * POST /api/import/jobs/:jobId/cancel
     */
    async cancelImportJob(req, res) {
        try {
            const { jobId } = req.params;
            
            const job = await this.importJobModel.findById(jobId);
            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Import job not found'
                });
            }

            if (job.status === 'completed' || job.status === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot cancel job with status: ${job.status}`
                });
            }

            await this.importJobModel.update(jobId, {
                status: 'cancelled',
                completed_at: new Date()
            });

            logger.info('Import job cancelled', { jobId });

            res.json({
                success: true,
                message: 'Import job cancelled successfully',
                job: {
                    id: job.id,
                    status: 'cancelled'
                }
            });

        } catch (error) {
            logger.error('Failed to cancel import job', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel import job'
            });
        }
    }

    /**
     * Get import job details with items
     * GET /api/import/jobs/:jobId/details
     */
    async getImportJobDetails(req, res) {
        try {
            const { jobId } = req.params;
            const { limit = 100, offset = 0 } = req.query;
            
            const job = await this.importJobModel.findById(jobId);
            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Import job not found'
                });
            }

            // Get job items with pagination
            const items = await this.importItemModel.findByJobId(jobId, {
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                job: {
                    id: job.id,
                    uuid: job.job_uuid,
                    status: job.status,
                    original_filename: job.original_filename,
                    total_items: job.total_items,
                    created_at: job.created_at
                },
                items: items.map(item => ({
                    id: item.id,
                    opms_item_code: item.opms_item_code,
                    status: item.status,
                    csv_row_number: item.csv_row_number,
                    last_error_message: item.last_error_message,
                    first_attempted_at: item.first_attempted_at,
                    last_attempted_at: item.last_attempted_at,
                    succeeded_at: item.succeeded_at
                })),
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: items.length
                }
            });

        } catch (error) {
            logger.error('Failed to get import job details', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get import job details'
            });
        }
    }

    /**
     * Generate unique job UUID
     * @returns {string} Unique job UUID
     */
    generateJobUuid() {
        return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = CsvImportController;
