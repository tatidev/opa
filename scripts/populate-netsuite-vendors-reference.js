#!/usr/bin/env node

/**
 * Populate NetSuite Vendors Reference Table
 * 
 * Reads the NetSuite vendor data from JSON and populates the database table
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../src/db');
const logger = require('../src/utils/logger');

async function populateNetSuiteVendors() {
    try {
        logger.info('🚀 Starting NetSuite vendors reference table population...');
        
        // Read the JSON file
        const jsonPath = path.join(__dirname, '..', 'DOCS', 'NetSuite-Integrations', 'NetSuite-Vendor-Extraction', 'netsuite-vendors-fullData-PROD-template.json');
        const jsonContent = await fs.readFile(jsonPath, 'utf8');
        const data = JSON.parse(jsonContent);
        
        logger.info(`📊 Found ${data.vendors.length} vendors to import`);
        logger.info(`📅 Extracted at: ${data.metadata.extractedAt}`);
        
        // Use database transaction
        await db.transaction(async (connection) => {
            // Clear existing data (optional - comment out if you want to preserve)
            logger.info('🗑️  Clearing existing NetSuite vendor data...');
            await connection.query('DELETE FROM netsuite_vendors_reference');
            
            // Prepare batch insert
            logger.info('📝 Preparing vendor data for insert...');
            
            const insertQuery = `
                INSERT INTO netsuite_vendors_reference 
                (id, entityid, companyname, displayname, isinactive, subsidiary, subsidiary_id, category, category_id, extracted_at)
                VALUES ?
            `;
            
            // Convert ISO datetime to MySQL datetime format
            const extractedAtMysql = data.metadata.extractedAt 
                ? new Date(data.metadata.extractedAt).toISOString().slice(0, 19).replace('T', ' ')
                : null;
            
            // Prepare values array
            const values = data.vendors.map(vendor => [
                vendor.id,
                vendor.entityid,
                vendor.companyname || null,
                vendor.displayName,
                vendor.isinactive ? 1 : 0,
                vendor.subsidiary || null,
                vendor.subsidiaryId || null,
                vendor.category || null,
                vendor.categoryId || null,
                extractedAtMysql
            ]);
            
            // Insert in batches to avoid query size limits
            const batchSize = 100;
            let inserted = 0;
            
            for (let i = 0; i < values.length; i += batchSize) {
                const batch = values.slice(i, i + batchSize);
                await connection.query(insertQuery, [batch]);
                inserted += batch.length;
                logger.info(`✅ Inserted ${inserted}/${values.length} vendors...`);
            }
        });
        
        // Verify insertion
        const countResult = await db.query('SELECT COUNT(*) as count FROM netsuite_vendors_reference');
        const totalCount = countResult[0].count;
        
        logger.info('═══════════════════════════════════════════════');
        logger.info('✅ NetSuite Vendors Reference Table Populated!');
        logger.info('═══════════════════════════════════════════════');
        logger.info(`📊 Total vendors in database: ${totalCount}`);
        logger.info(`📊 Active vendors: ${data.summary.activeVendors}`);
        logger.info(`📊 Inactive vendors: ${data.summary.inactiveVendors}`);
        logger.info(`📅 Data extracted: ${data.metadata.extractedAt}`);
        logger.info(`🌐 Source: ${data.metadata.source}`);
        logger.info('═══════════════════════════════════════════════');
        
        // Show sample data
        logger.info('\n📋 Sample vendor records:');
        const sampleVendors = await db.query(`
            SELECT id, entityid, displayname, subsidiary 
            FROM netsuite_vendors_reference 
            LIMIT 5
        `);
        
        sampleVendors.forEach((vendor, index) => {
            logger.info(`  ${index + 1}. [${vendor.id}] ${vendor.displayname} (${vendor.entityid}) - ${vendor.subsidiary}`);
        });
        
        return {
            success: true,
            totalInserted: totalCount,
            metadata: data.metadata
        };
        
    } catch (error) {
        logger.error('❌ Error populating NetSuite vendors:', error.message);
        logger.error(error.stack);
        throw error;
    }
}

// Run if executed directly
if (require.main === module) {
    populateNetSuiteVendors()
        .then(() => {
            logger.info('\n🎉 Population completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            logger.error('\n💥 Population failed:', error.message);
            process.exit(1);
        });
}

module.exports = populateNetSuiteVendors;

