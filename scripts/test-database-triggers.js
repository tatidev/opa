#!/usr/bin/env node

/**
 * Database Trigger Test for OPMS Sync
 * 
 * This script tests if the database triggers are working by:
 * 1. Checking if trigger tables exist
 * 2. Checking if triggers are installed
 * 3. Making test updates to trigger changes
 * 4. Verifying trigger activity in sync tables
 */

require('dotenv').config({ path: '.env.testing' });
const logger = require('../src/utils/logger');
const db = require('../src/db');

class TriggerTest {
    constructor() {
        this.testItemId = 13385; // Item from our previous tests
        this.testProductId = 2823; // Product from our previous tests
    }

    async run() {
        try {
            console.log('🔍 Database Trigger Test for OPMS Sync');
            console.log('=====================================');
            console.log(`Database: ${process.env.DB_NAME}`);
            console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
            console.log('');

            // Test 1: Check if sync tables exist
            console.log('📋 Test 1: Check Sync Tables Exist');
            await this.checkSyncTables();
            console.log('');

            // Test 2: Check if triggers are installed
            console.log('📋 Test 2: Check Triggers Are Installed');
            await this.checkTriggersInstalled();
            console.log('');

            // Test 3: Check current state of test item
            console.log('📋 Test 3: Check Current Test Item State');
            await this.checkTestItemState();
            console.log('');

            // Test 4: Make test update to trigger item change
            console.log('📋 Test 4: Trigger Item Update');
            await this.triggerItemUpdate();
            console.log('');

            // Test 5: Check for trigger activity
            console.log('📋 Test 5: Check Trigger Activity');
            await this.checkTriggerActivity();
            console.log('');

            // Test 6: Make test update to trigger product change
            console.log('📋 Test 6: Trigger Product Update');
            await this.triggerProductUpdate();
            console.log('');

            // Test 7: Check for product trigger activity
            console.log('📋 Test 7: Check Product Trigger Activity');
            await this.checkProductTriggerActivity();
            console.log('');

            console.log('✅ Trigger test completed successfully!');
            
        } catch (error) {
            console.error('❌ Trigger test failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        } finally {
            await db.end();
        }
    }

    async checkSyncTables() {
        try {
            const tables = [
                'opms_sync_queue',
                'opms_change_log', 
                'opms_item_sync_status'
            ];

            for (const table of tables) {
                const result = await db.query(`
                    SELECT COUNT(*) as count 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                `, [process.env.DB_NAME, table]);

                if (result[0].count > 0) {
                    console.log(`  ✅ Table '${table}' exists`);
                } else {
                    console.log(`  ❌ Table '${table}' does not exist`);
                }
            }
        } catch (error) {
            console.error('  ❌ Failed to check sync tables:', error.message);
            throw error;
        }
    }

    async checkTriggersInstalled() {
        try {
            const triggers = [
                'opms_item_sync_trigger',
                'opms_product_sync_trigger'
            ];

            for (const trigger of triggers) {
                const result = await db.query(`
                    SELECT COUNT(*) as count 
                    FROM information_schema.TRIGGERS 
                    WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = ?
                `, [process.env.DB_NAME, trigger]);

                if (result[0].count > 0) {
                    console.log(`  ✅ Trigger '${trigger}' is installed`);
                } else {
                    console.log(`  ❌ Trigger '${trigger}' is NOT installed`);
                }
            }
        } catch (error) {
            console.error('  ❌ Failed to check triggers:', error.message);
            throw error;
        }
    }

    async checkTestItemState() {
        try {
            // Check T_ITEM
            const itemResult = await db.query(`
                SELECT id, code, vendor_code, vendor_color, date_modif, archived
                FROM T_ITEM 
                WHERE id = ?
            `, [this.testItemId]);

            if (itemResult.length > 0) {
                const item = itemResult[0];
                console.log(`  ✅ Test item found: ${item.code}`);
                console.log(`  📝 Current vendor_code: "${item.vendor_code}"`);
                console.log(`  📝 Current vendor_color: "${item.vendor_color}"`);
                console.log(`  📝 Last modified: ${item.date_modif}`);
            } else {
                console.log(`  ❌ Test item ${this.testItemId} not found`);
            }

            // Check T_PRODUCT
            const productResult = await db.query(`
                SELECT id, name, width, vrepeat, hrepeat, date_modif, archived
                FROM T_PRODUCT 
                WHERE id = ?
            `, [this.testProductId]);

            if (productResult.length > 0) {
                const product = productResult[0];
                console.log(`  ✅ Test product found: ${product.name}`);
                console.log(`  📝 Current width: ${product.width}`);
                console.log(`  📝 Last modified: ${product.date_modif}`);
            } else {
                console.log(`  ❌ Test product ${this.testProductId} not found`);
            }
        } catch (error) {
            console.error('  ❌ Failed to check test item state:', error.message);
            throw error;
        }
    }

    async triggerItemUpdate() {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const testValue = `TRIGGER-TEST-${Date.now()}`;
            
            console.log(`  🔄 Updating item ${this.testItemId} vendor_code to: ${testValue}`);
            
            const result = await db.query(`
                UPDATE T_ITEM 
                SET vendor_code = ?, date_modif = ?
                WHERE id = ?
            `, [testValue, timestamp, this.testItemId]);

            console.log(`  ✅ Item update completed, affected rows: ${result.affectedRows}`);
        } catch (error) {
            console.error('  ❌ Failed to trigger item update:', error.message);
            throw error;
        }
    }

    async checkTriggerActivity() {
        try {
            // Check opms_sync_queue for new entries
            const queueResult = await db.query(`
                SELECT id, item_id, product_id, event_type, priority, status, created_at
                FROM opms_sync_queue 
                WHERE item_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            `, [this.testItemId]);

            console.log(`  📊 Found ${queueResult.length} sync queue entries for item ${this.testItemId}`);
            if (queueResult.length > 0) {
                const latest = queueResult[0];
                console.log(`  📝 Latest entry: ID ${latest.id}, Status: ${latest.status}, Created: ${latest.created_at}`);
            }

            // Check opms_change_log for new entries
            const logResult = await db.query(`
                SELECT id, item_id, product_id, change_type, change_source, detected_at
                FROM opms_change_log 
                WHERE item_id = ? 
                ORDER BY detected_at DESC 
                LIMIT 5
            `, [this.testItemId]);

            console.log(`  📊 Found ${logResult.length} change log entries for item ${this.testItemId}`);
            if (logResult.length > 0) {
                const latest = logResult[0];
                console.log(`  📝 Latest entry: ID ${latest.id}, Type: ${latest.change_type}, Source: ${latest.change_source}, Detected: ${latest.detected_at}`);
            }

            // Check if triggers are working
            if (queueResult.length > 0 && logResult.length > 0) {
                console.log('  ✅ Triggers are working! New entries found in sync tables');
            } else {
                console.log('  ⚠️  No new entries found - triggers may not be working');
            }
        } catch (error) {
            console.error('  ❌ Failed to check trigger activity:', error.message);
            throw error;
        }
    }

    async triggerProductUpdate() {
        try {
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const testValue = `TRIGGER-TEST-${Date.now()}`;
            
            console.log(`  🔄 Updating product ${this.testProductId} name to: ${testValue}`);
            
            const result = await db.query(`
                UPDATE T_PRODUCT 
                SET name = ?, date_modif = ?
                WHERE id = ?
            `, [testValue, timestamp, this.testProductId]);

            console.log(`  ✅ Product update completed, affected rows: ${result.affectedRows}`);
        } catch (error) {
            console.error('  ❌ Failed to trigger product update:', error.message);
            throw error;
        }
    }

    async checkProductTriggerActivity() {
        try {
            // Check opms_sync_queue for new entries from product update
            const queueResult = await db.query(`
                SELECT id, item_id, product_id, event_type, priority, status, created_at
                FROM opms_sync_queue 
                WHERE product_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10
            `, [this.testProductId]);

            console.log(`  📊 Found ${queueResult.length} sync queue entries for product ${this.testProductId}`);
            if (queueResult.length > 0) {
                const latest = queueResult[0];
                console.log(`  📝 Latest entry: ID ${latest.id}, Item: ${latest.item_id}, Status: ${latest.status}, Created: ${latest.created_at}`);
            }

            // Check opms_change_log for new entries
            const logResult = await db.query(`
                SELECT id, item_id, product_id, change_type, change_source, detected_at
                FROM opms_change_log 
                WHERE product_id = ? 
                ORDER BY detected_at DESC 
                LIMIT 5
            `, [this.testProductId]);

            console.log(`  📊 Found ${logResult.length} change log entries for product ${this.testProductId}`);
            if (logResult.length > 0) {
                const latest = logResult[0];
                console.log(`  📝 Latest entry: ID ${latest.id}, Type: ${latest.change_type}, Source: ${latest.change_source}, Detected: ${latest.detected_at}`);
            }

            // Check if product triggers are working
            if (queueResult.length > 0 && logResult.length > 0) {
                console.log('  ✅ Product triggers are working! New entries found in sync tables');
            } else {
                console.log('  ⚠️  No new entries found - product triggers may not be working');
            }
        } catch (error) {
            console.error('  ❌ Failed to check product trigger activity:', error.message);
            throw error;
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new TriggerTest();
    test.run().catch(console.error);
}

module.exports = TriggerTest;
