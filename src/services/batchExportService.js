/**
 * Batch Export Service
 * Uses the existing standard export endpoint internally to create large CSV files
 * by iterating through 1000-item batches and combining results
 */

const logger = require('../utils/logger');
const axios = require('axios');

class BatchExportService {
    constructor() {
        this.BATCH_SIZE = 1000; // Use the maximum allowed by standard export
        this.BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
    }

    /**
     * Export large dataset by iterating through batches
     * @param {Object} options - Export options
     * @param {string} options.baseUrl - Base URL for API calls
     * @param {Object} options.filters - Export filters
     * @param {number} options.maxItems - Maximum total items to export
     * @param {Function} options.progressCallback - Progress callback function
     * @returns {Promise<Object>} Combined export result
     */
    async batchExport(options = {}) {
        const {
            baseUrl = this.BASE_URL,
            filters = {},
            maxItems = 10000,
            progressCallback = null
        } = options;

        try {
            logger.info('Starting batch export', { maxItems, filters });

            // Determine iteration strategy based on available filters
            const iterationStrategy = this.determineIterationStrategy(filters);
            logger.info(`Using iteration strategy: ${iterationStrategy.type}`, iterationStrategy);

            // Execute batch export using the determined strategy
            const result = await this.executeBatchExport(baseUrl, iterationStrategy, maxItems, progressCallback, filters);

            logger.info('Batch export completed', {
                totalItems: result.totalItems,
                totalBatches: result.totalBatches,
                processingTime: result.processingTime
            });

            return result;

        } catch (error) {
            logger.error('Batch export failed:', error);
            throw error;
        }
    }

    /**
     * Determine the best iteration strategy based on available filters
     * @param {Object} filters - Export filters
     * @returns {Object} Iteration strategy
     */
    determineIterationStrategy(filters) {
        // Strategy 1: Item ID range iteration (most efficient)
        if (filters.itemIdStart || filters.itemIdEnd) {
            return {
                type: 'itemId',
                start: filters.itemIdStart || 1,
                end: filters.itemIdEnd || 999999,
                batchSize: this.BATCH_SIZE
            };
        }

        // Strategy 2: Product ID range iteration
        if (filters.productIdStart || filters.productIdEnd) {
            return {
                type: 'productId',
                start: filters.productIdStart || 1,
                end: filters.productIdEnd || 99999,
                batchSize: this.BATCH_SIZE
            };
        }

        // Strategy 3: Product name alphabetical iteration
        if (filters.productNameStart || filters.productNameEnd) {
            return {
                type: 'productName',
                start: filters.productNameStart || 'A',
                end: filters.productNameEnd || 'Z',
                batchSize: this.BATCH_SIZE
            };
        }

        // Strategy 4: Default - Item ID range from 1 to max
        return {
            type: 'itemId',
            start: 1,
            end: 999999,
            batchSize: this.BATCH_SIZE
        };
    }

    /**
     * Execute batch export using the specified strategy
     * @param {string} baseUrl - API base URL
     * @param {Object} strategy - Iteration strategy
     * @param {number} maxItems - Maximum items to export
     * @param {Function} progressCallback - Progress callback
     * @param {Object} baseFilters - Base filters to apply to all batches
     * @returns {Promise<Object>} Export result
     */
    async executeBatchExport(baseUrl, strategy, maxItems, progressCallback, baseFilters = {}) {
        const startTime = Date.now();
        let allItems = [];
        let totalBatches = 0;
        let currentBatch = 0;
        let headers = null;

        try {
            // Generate batch ranges based on strategy
            const batches = this.generateBatchRanges(strategy, maxItems);
            totalBatches = batches.length;

            logger.info(`Generated ${totalBatches} batches for processing`);

            // Process each batch
            for (const batch of batches) {
                currentBatch++;
                
                if (progressCallback) {
                    progressCallback({
                        currentBatch,
                        totalBatches,
                        itemsProcessed: allItems.length,
                        batchRange: batch
                    });
                }

                logger.info(`Processing batch ${currentBatch}/${totalBatches}`, batch);

                try {
                    // Call the standard export endpoint with batch parameters
                    const batchResult = await this.callStandardExport(baseUrl, batch, baseFilters);
                    
                    if (batchResult.items.length > 0) {
                        // Store headers from first successful batch
                        if (!headers) {
                            headers = batchResult.headers;
                        }
                        
                        allItems.push(...batchResult.items);
                        logger.info(`Batch ${currentBatch} completed: ${batchResult.items.length} items`);
                    } else {
                        logger.info(`Batch ${currentBatch} returned no items`);
                    }

                    // Small delay between batches to prevent overwhelming the database
                    await this.delay(100);

                } catch (batchError) {
                    logger.warn(`Batch ${currentBatch} failed:`, batchError.message);
                    // Continue with next batch instead of failing entire export
                }

                // Check if we've reached the maximum items limit
                if (allItems.length >= maxItems) {
                    logger.info(`Reached maximum items limit: ${maxItems}`);
                    allItems = allItems.slice(0, maxItems);
                    break;
                }
            }

            // Generate final CSV content
            const csvContent = this.generateCombinedCsv(headers, allItems);
            const processingTime = Date.now() - startTime;

            return {
                success: true,
                totalItems: allItems.length,
                totalBatches: currentBatch,
                processingTime: `${Math.round(processingTime / 1000)}s`,
                csvContent,
                filename: this.generateFilename(allItems.length, strategy),
                summary: {
                    strategy: strategy.type,
                    batchSize: this.BATCH_SIZE,
                    actualBatches: currentBatch,
                    estimatedBatches: totalBatches
                }
            };

        } catch (error) {
            logger.error('Batch export execution failed:', error);
            throw error;
        }
    }

    /**
     * Generate batch ranges for iteration
     * @param {Object} strategy - Iteration strategy
     * @param {number} maxItems - Maximum items
     * @returns {Array} Array of batch parameters
     */
    generateBatchRanges(strategy, maxItems) {
        const batches = [];
        const maxBatches = Math.ceil(maxItems / this.BATCH_SIZE);

        switch (strategy.type) {
            case 'itemId':
                for (let i = 0; i < maxBatches; i++) {
                    const start = strategy.start + (i * this.BATCH_SIZE);
                    const end = Math.min(start + this.BATCH_SIZE - 1, strategy.end);
                    batches.push({
                        itemIdStart: start,
                        itemIdEnd: end,
                        limit: this.BATCH_SIZE
                    });
                }
                break;

            case 'productId':
                for (let i = 0; i < maxBatches; i++) {
                    const start = strategy.start + (i * 100); // Smaller increments for product IDs
                    const end = Math.min(start + 99, strategy.end);
                    batches.push({
                        productIdStart: start,
                        productIdEnd: end,
                        limit: this.BATCH_SIZE
                    });
                }
                break;

            case 'productName':
                // For product names, we'll use alphabetical ranges
                const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                for (let i = 0; i < alphabet.length; i++) {
                    const start = alphabet[i];
                    const end = i < alphabet.length - 1 ? alphabet[i + 1] : 'Z';
                    batches.push({
                        productNameStart: start,
                        productNameEnd: end,
                        limit: this.BATCH_SIZE
                    });
                }
                break;

            default:
                throw new Error(`Unknown iteration strategy: ${strategy.type}`);
        }

        return batches.slice(0, maxBatches);
    }

    /**
     * Call the standard export endpoint with specific parameters
     * @param {string} baseUrl - API base URL
     * @param {Object} batchParams - Batch parameters
     * @param {Object} baseFilters - Base filters to apply
     * @returns {Promise<Object>} Batch result
     */
    async callStandardExport(baseUrl, batchParams, baseFilters = {}) {
        // Build query string from batch parameters and base filters
        // Default onlyValidCodes to true if not explicitly set
        const combinedParams = {
            ...baseFilters,
            ...batchParams,
            onlyValidCodes: baseFilters.onlyValidCodes !== undefined ? baseFilters.onlyValidCodes : 'true'
        };
        const queryParams = new URLSearchParams(combinedParams);

        const url = `${baseUrl}/api/export/csv?${queryParams}`;
        
        try {
            const response = await axios.get(url, {
                timeout: 120000, // 2 minute timeout for large batches
                responseType: 'text'
            });

            // Parse CSV response with proper escaping handling
            const { headers, items } = this.parseEscapedCsv(response.data);

            return {
                headers,
                items,
                rawData: response.data
            };

        } catch (error) {
            if (error.response?.status === 404) {
                // No items found for this batch - this is OK
                return { headers: [], items: [], rawData: '' };
            }
            throw error;
        }
    }

    /**
     * Generate combined CSV content from all batches
     * @param {Array} headers - CSV headers
     * @param {Array} allItems - All items from all batches
     * @returns {string} Combined CSV content
     */
    generateCombinedCsv(headers, allItems) {
        if (!headers || allItems.length === 0) {
            return '';
        }

        let csvContent = headers.join(',') + '\n';
        
        for (const item of allItems) {
            // Ensure item has the same number of columns as headers
            const paddedItem = [...item];
            while (paddedItem.length < headers.length) {
                paddedItem.push('');
            }
            
            // Apply CSV escaping to each field
            const escapedItem = paddedItem.slice(0, headers.length).map(field => {
                return this.escapeCsvField(field);
            });
            
            csvContent += escapedItem.join(',') + '\n';
        }

        return csvContent;
    }

    /**
     * Escape a CSV field value using the same logic as the main export
     * @param {string} value - Field value to escape
     * @returns {string} Escaped field value
     */
    escapeCsvField(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        const stringValue = String(value);
        
        // Check if escaping is needed
        const needsEscaping = stringValue.includes(',') || 
                             stringValue.includes('"') || 
                             stringValue.includes('\n') || 
                             stringValue.includes("'");
        
        if (needsEscaping) {
            // Escape internal quotes by doubling them
            const escapedValue = stringValue.replace(/"/g, '""');
            return `"${escapedValue}"`;
        }
        
        return stringValue;
    }

    /**
     * Generate descriptive filename for the combined export
     * @param {number} itemCount - Total items exported
     * @param {Object} strategy - Iteration strategy used
     * @returns {string} Generated filename
     */
    generateFilename(itemCount, strategy) {
        const timestamp = Date.now();
        return `batch-export-${itemCount}-items-${strategy.type}-${timestamp}.csv`;
    }

    /**
     * Parse CSV content with proper handling of escaped fields
     * This matches the escaping logic used in the main export
     * @param {string} csvContent - Raw CSV content
     * @returns {Object} Parsed headers and items
     */
    parseEscapedCsv(csvContent) {
        if (!csvContent || !csvContent.trim()) {
            return { headers: [], items: [] };
        }

        const lines = [];
        let currentLine = '';
        let insideQuotes = false;
        let i = 0;

        // Parse character by character to handle multi-line quoted fields
        while (i < csvContent.length) {
            const char = csvContent[i];
            
            if (char === '"') {
                // Check for escaped quotes ("")
                if (i + 1 < csvContent.length && csvContent[i + 1] === '"') {
                    currentLine += '"'; // Add single quote for escaped quote
                    i += 2; // Skip both quotes
                    continue;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === '\n' && !insideQuotes) {
                if (currentLine.trim()) {
                    lines.push(currentLine);
                }
                currentLine = '';
                i++;
                continue;
            } else {
                currentLine += char;
            }
            i++;
        }
        
        // Add the last line if it exists
        if (currentLine.trim()) {
            lines.push(currentLine);
        }

        if (lines.length === 0) {
            return { headers: [], items: [] };
        }

        // Parse headers
        const headers = this.parseCsvLine(lines[0]);
        
        // Parse data lines
        const items = lines.slice(1)
            .filter(line => line.trim())
            .map(line => this.parseCsvLine(line));

        return { headers, items };
    }

    /**
     * Parse a single CSV line with proper quote handling
     * @param {string} line - CSV line to parse
     * @returns {Array} Array of field values
     */
    parseCsvLine(line) {
        const fields = [];
        let currentField = '';
        let insideQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                // Check for escaped quotes ("")
                if (i + 1 < line.length && line[i + 1] === '"') {
                    currentField += '"'; // Add single quote for escaped quote
                    i += 2; // Skip both quotes
                    continue;
                } else {
                    // Toggle quote state but don't add the quote character itself
                    insideQuotes = !insideQuotes;
                    i++;
                    continue;
                }
            } else if (char === ',' && !insideQuotes) {
                fields.push(currentField);
                currentField = '';
                i++;
                continue;
            } else {
                currentField += char;
            }
            i++;
        }
        
        // Add the last field
        fields.push(currentField);
        
        return fields;
    }

    /**
     * Simple delay utility
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BatchExportService;
