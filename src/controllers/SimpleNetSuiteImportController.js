/**
 * Simple NetSuite CSV Import Controller
 * Synchronous processing, immediate results, no background jobs
 * Eliminates async complexity that causes issues between Node.js versions
 */

const CsvToNetSuiteTransformService = require('../services/csvToNetSuiteTransformService');
const netsuiteRestletService = require('../services/netsuiteRestletService');
const logger = require('../utils/logger');

class SimpleNetSuiteImportController {
    constructor() {
        this.transformService = new CsvToNetSuiteTransformService();
    }

    /**
     * Simple CSV to NetSuite import - synchronous processing
     * POST /api/netsuite/import/simple
     */
    async simpleImport(req, res) {
        try {
            logger.info('Simple NetSuite CSV import started', {
                filename: req.file?.originalname,
                size: req.file?.size
            });

            // Validate file upload
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No CSV file provided'
                });
            }

            // Save uploaded file temporarily
            const tempFilePath = `/tmp/simple-netsuite-import-${Date.now()}.csv`;
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

            logger.info(`Transformed ${transformResult.transformedItems.length} items for NetSuite`);

            // Process items SYNCHRONOUSLY - no background jobs
            const results = [];
            let successCount = 0;
            let failureCount = 0;

            for (let i = 0; i < transformResult.transformedItems.length; i++) {
                const transformedItem = transformResult.transformedItems[i];
                const payload = transformedItem.payload;

                logger.info(`Processing item ${i + 1}/${transformResult.transformedItems.length}: ${payload.itemId}`);

                try {
                    // Call NetSuite directly - no async complexity
                    const netsuiteResult = await netsuiteRestletService.createLotNumberedInventoryItem(payload);
                    
                    results.push({
                        itemId: payload.itemId,
                        success: true,
                        netsuiteId: netsuiteResult.id,
                        result: netsuiteResult
                    });
                    
                    successCount++;
                    logger.info(`✅ Successfully created NetSuite item: ${payload.itemId}`);

                } catch (error) {
                    results.push({
                        itemId: payload.itemId,
                        success: false,
                        error: error.message
                    });
                    
                    failureCount++;
                    logger.error(`❌ Failed to create NetSuite item ${payload.itemId}:`, error.message);
                }

                // Small delay between items to respect NetSuite rate limits
                if (i < transformResult.transformedItems.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Clean up temporary file
            try {
                require('fs').unlinkSync(tempFilePath);
            } catch (cleanupError) {
                logger.warn(`Failed to clean up temporary file: ${tempFilePath}`);
            }

            // Return immediate results
            const response = {
                success: true,
                message: 'Simple NetSuite import completed',
                data: {
                    totalItems: transformResult.transformedItems.length,
                    successfulItems: successCount,
                    failedItems: failureCount,
                    successRate: Math.round((successCount / transformResult.transformedItems.length) * 100),
                    results: results,
                    transformationStats: this.transformService.getTransformationStats(transformResult)
                }
            };

            logger.info('Simple NetSuite import completed', {
                total: transformResult.transformedItems.length,
                successful: successCount,
                failed: failureCount,
                successRate: response.data.successRate
            });

            res.status(200).json(response);

        } catch (error) {
            logger.error('Simple NetSuite CSV import failed:', error);
            res.status(500).json({
                success: false,
                error: 'Simple NetSuite import failed',
                message: error.message
            });
        }
    }
}

module.exports = SimpleNetSuiteImportController;
