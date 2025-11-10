#!/usr/bin/env node

/**
 * OPMS to NetSuite Batch Re-Sync Script
 * 
 * Purpose: Re-sync all OPMS items with valid "nnnn-nnnn" code format AND vendor data to NetSuite
 * 
 * Usage:
 *   node scripts/resync-all-valid-code-items.js [options]
 * 
 * Options:
 *   --limit N          Limit number of items to sync (default: all)
 *   --dry-run          Show what would be synced without actually queueing
 *   --priority LEVEL   Set priority: HIGH, NORMAL, LOW (default: NORMAL)
 *   --batch-size N     Process in batches of N items (default: 50)
 *   --delay MS         Delay between batches in milliseconds (default: 1000)
 * 
 * Examples:
 *   # Dry run to see what would be synced
 *   node scripts/resync-all-valid-code-items.js --dry-run
 * 
 *   # Sync first 100 items
 *   node scripts/resync-all-valid-code-items.js --limit 100
 * 
 *   # Sync all items with high priority
 *   node scripts/resync-all-valid-code-items.js --priority HIGH
 */

const path = require('path');
const BaseModel = require('../src/models/BaseModel');
const logger = require('../src/utils/logger');
const OpmsChangeDetectionService = require('../src/services/OpmsChangeDetectionService');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    limit: null,
    dryRun: false,
    priority: 'NORMAL',
    batchSize: 50,
    delay: 1000,
    reason: 'Manual batch re-sync of all valid code items'
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--limit':
            options.limit = parseInt(args[++i]);
            break;
        case '--dry-run':
            options.dryRun = true;
            break;
        case '--priority':
            options.priority = args[++i].toUpperCase();
            break;
        case '--batch-size':
            options.batchSize = parseInt(args[++i]);
            break;
        case '--delay':
            options.delay = parseInt(args[++i]);
            break;
        case '--help':
        case '-h':
            console.log(`
OPMS to NetSuite Batch Re-Sync Script

Purpose: Re-sync all OPMS items with valid "nnnn-nnnn" code format AND vendor data to NetSuite

Usage:
  node scripts/resync-all-valid-code-items.js [options]

Options:
  --limit N          Limit number of items to sync (default: all)
  --dry-run          Show what would be synced without actually queueing
  --priority LEVEL   Set priority: HIGH, NORMAL, LOW (default: NORMAL)
  --batch-size N     Process in batches of N items (default: 50)
  --delay MS         Delay between batches in milliseconds (default: 1000)

Note: Only items with complete vendor data and NetSuite vendor mapping are included

Stopping: Press Ctrl+C to stop gracefully at any time

Examples:
  # Dry run to see what would be synced
  node scripts/resync-all-valid-code-items.js --dry-run

  # Sync first 100 items
  node scripts/resync-all-valid-code-items.js --limit 100

  # Sync all items with high priority, smaller batches
  node scripts/resync-all-valid-code-items.js --priority HIGH --batch-size 25
            `);
            process.exit(0);
    }
}

// Validate priority
if (!['HIGH', 'NORMAL', 'LOW'].includes(options.priority)) {
    console.error(`Invalid priority: ${options.priority}. Must be HIGH, NORMAL, or LOW.`);
    process.exit(1);
}

class BatchResyncService extends BaseModel {
    constructor() {
        super();
        this.changeDetectionService = new OpmsChangeDetectionService();
    }

    /**
     * Get all items with valid "nnnn-nnnn" code format AND vendor data
     * @returns {Promise<Array>} Array of items
     */
    async getValidCodeItems(limit = null) {
        const query = `
            SELECT DISTINCT
                i.id as item_id,
                i.code as item_code,
                i.product_id,
                p.name as product_name,
                v.id as vendor_id,
                v.name as vendor_name,
                m.netsuite_vendor_id,
                GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') as color_names
            FROM T_ITEM i
            JOIN T_PRODUCT p ON i.product_id = p.id
            JOIN T_PRODUCT_VENDOR pv ON p.id = pv.product_id
            JOIN Z_VENDOR v ON pv.vendor_id = v.id
            JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
            LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
            LEFT JOIN P_COLOR c ON ic.color_id = c.id
            WHERE 
                -- Item must have valid code format: nnnn-nnnn (4 digits, hyphen, 4 digits)
                i.code REGEXP '^[0-9]{4}-[0-9]{4}$'
                -- Active items only
                AND i.archived = 'N'
                AND p.archived = 'N'
                AND v.active = 'Y'
                AND v.archived = 'N'
                -- Required fields
                AND i.code IS NOT NULL
                AND p.name IS NOT NULL
                AND v.name IS NOT NULL
                AND m.netsuite_vendor_id IS NOT NULL
                -- Only accurate vendor mappings (vendor names match)
                AND m.opms_vendor_name = m.netsuite_vendor_name
            GROUP BY 
                i.id, i.code, i.product_id, p.name, v.id, v.name, m.netsuite_vendor_id
            ORDER BY i.id ASC
            ${limit ? `LIMIT ${limit}` : ''}
        `;

        const [rows] = await this.db.query(query);
        return rows || [];
    }

    /**
     * Queue items for sync in batches
     * @param {Array} items - Items to sync
     * @param {Object} options - Sync options
     * @returns {Promise<Object>} Results summary
     */
    async queueItemsForSync(items, options) {
        const results = {
            total: items.length,
            queued: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            interrupted: false
        };

        logger.info(`Starting batch re-sync of ${items.length} items`, {
            priority: options.priority,
            batchSize: options.batchSize,
            dryRun: options.dryRun
        });

        // Process items in batches
        for (let i = 0; i < items.length; i += options.batchSize) {
            // Check if interrupted
            if (options.onInterrupt && options.onInterrupt()) {
                results.interrupted = true;
                logger.info(`Re-sync interrupted by user. Processed ${results.queued + results.skipped} of ${items.length} items`);
                break;
            }

            const batch = items.slice(i, i + options.batchSize);
            const batchNumber = Math.floor(i / options.batchSize) + 1;
            const totalBatches = Math.ceil(items.length / options.batchSize);

            logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

            // Process batch items in parallel
            const batchResults = await Promise.allSettled(
                batch.map(item => this.queueSingleItem(item, options))
            );

            // Tally results
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    if (result.value.queued) {
                        results.queued++;
                    } else {
                        results.skipped++;
                    }
                } else {
                    results.failed++;
                    results.errors.push({
                        item: result.reason.itemId || 'unknown',
                        error: result.reason.message
                    });
                }
            }

            // Progress update
            logger.info(`Batch ${batchNumber}/${totalBatches} complete`, {
                queued: results.queued,
                skipped: results.skipped,
                failed: results.failed
            });

            // Delay between batches (except for last batch)
            if (i + options.batchSize < items.length && !options.onInterrupt()) {
                await this.delay(options.delay);
            }
        }

        return results;
    }

    /**
     * Queue a single item for sync
     * @param {Object} item - Item data
     * @param {Object} options - Sync options
     * @returns {Promise<Object>} Result
     */
    async queueSingleItem(item, options) {
        try {
            if (options.dryRun) {
                logger.info(`[DRY RUN] Would queue item for sync`, {
                    itemId: item.item_id,
                    itemCode: item.item_code,
                    productName: item.product_name,
                    vendorName: item.vendor_name || 'No vendor'
                });
                return { queued: true };
            }

            // Queue item using change detection service
            const syncJob = await this.changeDetectionService.queueSyncItem(
                item.item_id,
                item.product_id,
                'UPDATE', // Event type
                {
                    trigger_source: 'batch_resync_script',
                    reason: options.reason,
                    triggered_by: 'system',
                    triggered_at: new Date().toISOString()
                },
                options.priority
            );

            if (syncJob) {
                logger.debug(`Item queued for sync`, {
                    itemId: item.item_id,
                    itemCode: item.item_code,
                    syncJobId: syncJob.id
                });
                return { queued: true, syncJobId: syncJob.id };
            } else {
                // Item was skipped (likely digital or invalid format)
                logger.debug(`Item skipped (digital or invalid)`, {
                    itemId: item.item_id,
                    itemCode: item.item_code
                });
                return { queued: false, reason: 'Skipped by validation' };
            }
        } catch (error) {
            logger.error(`Failed to queue item`, {
                itemId: item.item_id,
                itemCode: item.item_code,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Print summary report
     * @param {Object} results - Results object
     * @param {Object} options - Options used
     */
    printSummary(results, options) {
        console.log('\n' + '='.repeat(70));
        console.log('BATCH RE-SYNC SUMMARY');
        if (results.interrupted) {
            console.log('⚠️  INTERRUPTED BY USER');
        }
        console.log('='.repeat(70));
        console.log(`Mode:              ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
        console.log(`Priority:          ${options.priority}`);
        console.log(`Batch Size:        ${options.batchSize}`);
        console.log(`Delay (ms):        ${options.delay}`);
        console.log('-'.repeat(70));
        console.log(`Total Items:       ${results.total}`);
        console.log(`Successfully Queued: ${results.queued}`);
        console.log(`Skipped:           ${results.skipped}`);
        console.log(`Failed:            ${results.failed}`);
        if (results.interrupted) {
            console.log(`Interrupted:       Yes - Processing stopped early`);
        }
        console.log('-'.repeat(70));

        if (results.failed > 0) {
            console.log('\nFailed Items:');
            results.errors.slice(0, 10).forEach((err, idx) => {
                console.log(`  ${idx + 1}. Item ${err.item}: ${err.error}`);
            });
            if (results.errors.length > 10) {
                console.log(`  ... and ${results.errors.length - 10} more errors`);
            }
        }

        console.log('='.repeat(70));
        
        if (!options.dryRun && results.queued > 0) {
            console.log('\n✅ Items have been queued for sync.');
            console.log('   Monitor progress at: /api/opms-sync/queue');
            console.log('   Check sync dashboard for detailed status.');
        } else if (options.dryRun) {
            console.log('\n💡 This was a dry run. No items were actually queued.');
            console.log('   Remove --dry-run flag to perform actual sync.');
        }
        console.log('');
    }
}

/**
 * Main execution function
 */
async function main() {
    const service = new BatchResyncService();
    let isInterrupted = false;
    let interruptedResults = null;
    
    // Handle interrupt signals (Ctrl+C, SIGTERM)
    const handleInterrupt = async (signal) => {
        if (isInterrupted) {
            console.log('\n\n⚠️  Forced exit - cleaning up and exiting immediately...');
            process.exit(1);
        }
        
        isInterrupted = true;
        console.log('\n\n⚠️  Interrupt signal received (Ctrl+C pressed)');
        console.log('   Gracefully stopping... Please wait...\n');
        
        // If we have interrupted results, show them
        if (interruptedResults) {
            service.printSummary(interruptedResults, options);
        } else {
            console.log('   No items processed yet. Exiting safely.');
        }
        
        console.log('\n✅ Batch re-sync interrupted safely.');
        console.log('   Items that were already queued will continue to sync in the background.');
        console.log('   Monitor progress at: /api/opms-sync/queue\n');
        
        // Clean up and exit
        await service.closeConnection();
        process.exit(0);
    };
    
    process.on('SIGINT', () => handleInterrupt('SIGINT'));
    process.on('SIGTERM', () => handleInterrupt('SIGTERM'));
    
    try {
        console.log('\n🔄 OPMS to NetSuite Batch Re-Sync Script');
        console.log('==========================================\n');
        
        if (options.dryRun) {
            console.log('⚠️  DRY RUN MODE - No items will be actually queued\n');
        }

        // Get items to sync
        console.log('📊 Fetching items with valid code format (nnnn-nnnn) AND vendor data...');
        const items = await service.getValidCodeItems(options.limit);
        
        if (items.length === 0) {
            console.log('\n❌ No items found matching criteria.');
            console.log('   Ensure items have:');
            console.log('   - Code format: nnnn-nnnn (4 digits, hyphen, 4 digits)');
            console.log('   - Active vendor data');
            console.log('   - Valid NetSuite vendor mapping');
            console.log('   - Not archived');
            console.log('   - Valid product association');
            process.exit(0);
        }

        console.log(`✅ Found ${items.length} items with vendor data to sync\n`);

        // Show sample items
        console.log('Sample items to be synced:');
        items.slice(0, 5).forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.item_code} - ${item.product_name} [Vendor: ${item.vendor_name}] (Item ID: ${item.item_id})`);
        });
        if (items.length > 5) {
            console.log(`  ... and ${items.length - 5} more items`);
        }
        console.log('');

        // Confirm if not dry run
        if (!options.dryRun) {
            console.log(`⚠️  About to queue ${items.length} items for sync with priority: ${options.priority}`);
            console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
            await service.delay(5000);
        }

        // Queue items for sync
        const results = await service.queueItemsForSync(items, { ...options, onInterrupt: () => isInterrupted });
        
        // Store results in case of interruption
        interruptedResults = results;

        // Print summary
        service.printSummary(results, options);

        // Exit with appropriate code
        process.exit(results.failed > 0 ? 1 : 0);

    } catch (error) {
        logger.error('Batch re-sync failed', {
            error: error.message,
            stack: error.stack
        });
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        await service.closeConnection();
    }
}

// Run the script
main();

