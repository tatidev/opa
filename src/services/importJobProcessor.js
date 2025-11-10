/**
 * Import Job Processor Service
 * Processes CSV import jobs and executes database operations
 */

const DatabaseOperationExecutor = require('./databaseOperationExecutor');
const ImportJobModel = require('../models/ImportJobModel');
const ImportItemModel = require('../models/ImportItemModel');
const logger = require('../utils/logger');
const ProductModel = require('../models/ProductModel');

class ImportJobProcessor {
    constructor() {
        this.operationExecutor = new DatabaseOperationExecutor();
        this.importJobModel = new ImportJobModel();
        this.importItemModel = new ImportItemModel();
        this.productModel = new ProductModel();
    }

    /**
     * Set database connection
     * @param {Object} db - Database connection
     */
    setDatabase(db) {
        this.operationExecutor.setDatabase(db);
        this.importJobModel.db = db;
        this.importItemModel.db = db;
        this.productModel.db = db;
    }

    /**
     * Process a CSV import job
     * @param {number} jobId - Import job ID
     * @param {Array} transformedData - Transformed CSV data with operations
     * @returns {Promise<Object>} Processing results
     */
    async processJob(jobId, transformedData) {
        try {
            logger.info(`Starting to process import job ${jobId}`, {
                jobId: jobId,
                totalRows: transformedData.length
            });

            // Update job status to processing
            await this.importJobModel.update(jobId, {
                status: 'processing',
                started_at: new Date()
            });

            const results = {
                jobId: jobId,
                totalRows: transformedData.length,
                processedRows: 0,
                successfulRows: 0,
                failedRows: 0,
                rowResults: []
            };

            // Process each row sequentially
            for (let i = 0; i < transformedData.length; i++) {
                const rowData = transformedData[i];
                const rowNumber = i + 1;

                try {
                    logger.info(`Processing row ${rowNumber} for job ${jobId}`);

                    // Execute database operations for this row
                    const rowResult = await this.processRow(rowData, rowNumber);
                    
                    results.rowResults.push(rowResult);
                    results.processedRows++;

                    if (rowResult.success) {
                        results.successfulRows++;
                        
                        // Update import item status to success
                        await this.importItemModel.updateByJobAndRow(jobId, rowNumber, {
                            status: 'success',
                            succeeded_at: new Date()
                        });
                    } else {
                        results.failedRows++;
                        
                        // Update import item status to failed
                        await this.importItemModel.updateByJobAndRow(jobId, rowNumber, {
                            status: 'failed_permanent',
                            last_error_message: rowResult.error || 'Unknown error'
                        });
                    }

                    // Update job progress
                    await this.updateJobProgress(jobId, results);

                } catch (error) {
                    logger.error(`Failed to process row ${rowNumber} for job ${jobId}`, error);
                    
                    results.failedRows++;
                    results.rowResults.push({
                        rowNumber: rowNumber,
                        success: false,
                        error: error.message
                    });

                    // Update import item status to failed
                    await this.importItemModel.updateByJobAndRow(jobId, rowNumber, {
                        status: 'failed_permanent',
                        last_error_message: error.message
                    });
                }
            }

            // Update final job status
            const finalStatus = results.failedRows === 0 ? 'completed' : 'completed_with_errors';
            await this.importJobModel.update(jobId, {
                status: finalStatus,
                completed_at: new Date(),
                items_processed: results.processedRows,
                items_succeeded: results.successfulRows,
                items_failed_permanent: results.failedRows
            });

            // Rebuild product cache after successful import
            if (finalStatus === 'completed') {
                try {
                    logger.info(`Rebuilding product cache after successful import job ${jobId}`);
                    const cacheRebuildResult = await this.productModel.buildCachedProductSpecView();
                    
                    if (cacheRebuildResult) {
                        logger.info(`Product cache rebuilt successfully after import job ${jobId}`);
                    } else {
                        logger.warn(`Product cache rebuild failed after import job ${jobId} - search results may be stale until cache is manually rebuilt`);
                    }
                } catch (cacheError) {
                    logger.error(`Error rebuilding product cache after import job ${jobId}`, {
                        error: cacheError.message,
                        code: cacheError.code,
                        sqlState: cacheError.sqlState,
                        jobId: jobId,
                        action: 'continue_import_success',
                        note: 'CSV import completed successfully - cache rebuild failure does not affect imported data'
                    });
                    // Don't fail the import job due to cache rebuild issues
                    // The data is still imported successfully into the OPMS database tables
                }
            }

            logger.info(`Completed processing import job ${jobId}`, {
                jobId: jobId,
                totalRows: results.totalRows,
                successfulRows: results.successfulRows,
                failedRows: results.failedRows,
                finalStatus: finalStatus
            });

            return results;

        } catch (error) {
            logger.error(`Failed to process import job ${jobId}`, error);
            
            // Update job status to failed
            await this.importJobModel.update(jobId, {
                status: 'failed',
                completed_at: new Date()
            });

            throw error;
        }
    }

    /**
     * Process a single CSV row
     * @param {Object} rowData - Transformed row data with operations
     * @param {number} rowNumber - Row number for tracking
     * @returns {Promise<Object>} Row processing result
     */
    async processRow(rowData, rowNumber) {
        try {
            const { operations, errors } = rowData;

            // Check if row has validation errors
            if (errors && errors.length > 0) {
                return {
                    rowNumber: rowNumber,
                    success: false,
                    error: `Validation errors: ${errors.join('; ')}`
                };
            }

            // Check if row has operations
            if (!operations || operations.length === 0) {
                return {
                    rowNumber: rowNumber,
                    success: false,
                    error: 'No database operations generated for this row'
                };
            }

            // Execute all operations for this row
            const operationResults = await this.operationExecutor.executeOperations(operations);

            // Determine if row was successful
            const hasFailures = operationResults.results.some(result => !result.success);
            
            if (hasFailures) {
                const failedOperations = operationResults.results
                    .filter(result => !result.success)
                    .map(result => `${result.operationType}: ${result.error}`);

                return {
                    rowNumber: rowNumber,
                    success: false,
                    error: `Operation failures: ${failedOperations.join('; ')}`,
                    operationResults: operationResults
                };
            }

            return {
                rowNumber: rowNumber,
                success: true,
                operationResults: operationResults
            };

        } catch (error) {
            logger.error(`Error processing row ${rowNumber}`, error);
            return {
                rowNumber: rowNumber,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update job progress
     * @param {number} jobId - Import job ID
     * @param {Object} progress - Progress information
     */
    async updateJobProgress(jobId, progress) {
        try {
            await this.importJobModel.update(jobId, {
                items_processed: progress.processedRows,
                items_succeeded: progress.successfulRows,
                items_failed_permanent: progress.failedRows
            });

            logger.debug(`Updated job ${jobId} progress`, {
                jobId: jobId,
                processed: progress.processedRows,
                successful: progress.successfulRows,
                failed: progress.failedRows
            });

        } catch (error) {
            logger.error(`Failed to update job ${jobId} progress`, error);
        }
    }

    /**
     * Get job processing status
     * @param {number} jobId - Import job ID
     * @returns {Promise<Object>} Job status
     */
    async getJobStatus(jobId) {
        try {
            const job = await this.importJobModel.findById(jobId);
            if (!job) {
                throw new Error(`Job ${jobId} not found`);
            }

            const items = await this.importItemModel.findByJobId(jobId);
            
            const status = {
                jobId: jobId,
                status: job.status,
                totalItems: job.total_items,
                processedItems: job.items_processed || 0,
                successfulItems: job.items_succeeded || 0,
                failedItems: job.items_failed_permanent || 0,
                progress: job.total_items > 0 ? Math.round((job.items_processed || 0) / job.total_items * 100) : 0,
                createdAt: job.created_at,
                startedAt: job.started_at,
                completedAt: job.completed_at
            };

            return status;

        } catch (error) {
            logger.error(`Failed to get job ${jobId} status`, error);
            throw error;
        }
    }

    /**
     * Cancel a job
     * @param {number} jobId - Import job ID
     * @returns {Promise<boolean>} Success status
     */
    async cancelJob(jobId) {
        try {
            const job = await this.importJobModel.findById(jobId);
            if (!job) {
                throw new Error(`Job ${jobId} not found`);
            }

            if (job.status === 'completed' || job.status === 'failed') {
                throw new Error(`Cannot cancel job in status: ${job.status}`);
            }

            await this.importJobModel.update(jobId, {
                status: 'cancelled',
                completed_at: new Date()
            });

            logger.info(`Cancelled import job ${jobId}`);
            return true;

        } catch (error) {
            logger.error(`Failed to cancel job ${jobId}`, error);
            throw error;
        }
    }
}

module.exports = ImportJobProcessor;
