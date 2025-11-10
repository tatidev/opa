#!/usr/bin/env node

/**
 * Test script to debug database query structure
 */

require('dotenv').config();
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function testDatabaseQuery() {
    try {
        console.log('🧪 Testing database query structure...');
        
        await db.initialize();
        console.log('✅ Database initialized');
        
        const [items] = await db.query(`
          SELECT id, code, product_id 
          FROM T_ITEM 
          WHERE archived = 'N' 
          AND code IS NOT NULL 
          AND code != ''
          ORDER BY id DESC 
          LIMIT 1
        `);
        
        console.log('📊 Query result structure:');
        console.log('items type:', typeof items);
        console.log('items length:', items?.length);
        console.log('items[0]:', items?.[0]);
        console.log('items[0].id:', items?.[0]?.id);
        
        if (items && items.length > 0) {
            console.log('✅ Query successful');
            console.log('Sample item:', items[0]);
        } else {
            console.log('❌ No items found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await db.end();
        console.log('🔌 Database connection closed');
    }
}

// Run test if this script is executed directly
if (require.main === module) {
    testDatabaseQuery().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Test script failed:', error);
        process.exit(1);
    });
}

module.exports = testDatabaseQuery;
