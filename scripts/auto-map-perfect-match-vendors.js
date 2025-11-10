#!/usr/bin/env node

/**
 * Auto-Map Perfect Match Vendors
 * 
 * Automatically creates vendor mappings for OPMS vendors that have
 * 100% name match (similarity = 1.00) with NetSuite vendors
 * 
 * Usage: node scripts/auto-map-perfect-match-vendors.js
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../src/db');
const logger = require('../src/utils/logger');

class PerfectMatchVendorMapper {
    constructor() {
        this.diagnosticReport = null;
        this.perfectMatches = [];
        this.mappingsCreated = 0;
        this.mappingsFailed = 0;
        this.results = [];
    }

    /**
     * Load diagnostic report
     */
    async loadDiagnosticReport() {
        try {
            logger.info('📥 Loading diagnostic report...');
            
            const reportPath = path.join(
                __dirname,
                '..',
                'DOCS',
                'NetSuite-Integrations',
                'NetSuite-Vendor-Extraction',
                'vendor-mapping-diagnostic-report.json'
            );
            
            const content = await fs.readFile(reportPath, 'utf8');
            this.diagnosticReport = JSON.parse(content);
            
            logger.info('✅ Diagnostic report loaded');
            
        } catch (error) {
            logger.error('❌ Error loading diagnostic report:', error.message);
            throw error;
        }
    }

    /**
     * Extract perfect matches (similarity = 1.00)
     */
    extractPerfectMatches() {
        logger.info('🔍 Extracting perfect matches...');
        
        this.perfectMatches = this.diagnosticReport.unmapped_opms
            .filter(item => {
                return item.suggestion && 
                       item.suggestion.similarity === 1.00;
            })
            .map(item => ({
                opms_vendor_id: item.vendor.id,
                opms_vendor_name: item.vendor.name,
                opms_vendor_abrev: item.vendor.abbreviation,
                netsuite_vendor_id: item.suggestion.id,
                netsuite_vendor_name: item.suggestion.name,
                similarity: item.suggestion.similarity
            }));
        
        logger.info(`✅ Found ${this.perfectMatches.length} perfect matches (100% similarity)`);
        
        return this.perfectMatches;
    }

    /**
     * Create a single vendor mapping
     */
    async createMapping(mapping) {
        try {
            const query = `
                INSERT INTO opms_netsuite_vendor_mapping 
                (
                    opms_vendor_id,
                    opms_vendor_name,
                    opms_vendor_abrev,
                    netsuite_vendor_id,
                    netsuite_vendor_name,
                    is_active,
                    mapping_confidence,
                    mapping_method,
                    notes,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, 1, 'high', 'auto', 'Auto-mapped: 100% name match', NOW(), NOW())
            `;
            
            const values = [
                mapping.opms_vendor_id,
                mapping.opms_vendor_name,
                mapping.opms_vendor_abrev || null,
                mapping.netsuite_vendor_id,
                mapping.netsuite_vendor_name
            ];
            
            await db.query(query, values);
            
            this.mappingsCreated++;
            this.results.push({
                success: true,
                opms_vendor_name: mapping.opms_vendor_name,
                netsuite_vendor_name: mapping.netsuite_vendor_name,
                opms_id: mapping.opms_vendor_id,
                netsuite_id: mapping.netsuite_vendor_id
            });
            
            return true;
            
        } catch (error) {
            this.mappingsFailed++;
            this.results.push({
                success: false,
                opms_vendor_name: mapping.opms_vendor_name,
                error: error.message
            });
            
            logger.error(`❌ Failed to create mapping for ${mapping.opms_vendor_name}:`, error.message);
            return false;
        }
    }

    /**
     * Create all mappings in batch
     */
    async createAllMappings() {
        logger.info(`🚀 Creating ${this.perfectMatches.length} vendor mappings...`);
        
        let processed = 0;
        const batchSize = 10;
        
        for (let i = 0; i < this.perfectMatches.length; i += batchSize) {
            const batch = this.perfectMatches.slice(i, i + batchSize);
            
            await Promise.all(batch.map(mapping => this.createMapping(mapping)));
            
            processed += batch.length;
            logger.info(`📊 Progress: ${processed}/${this.perfectMatches.length} mappings processed`);
        }
        
        logger.info('✅ All mappings processed');
    }

    /**
     * Verify mappings were created
     */
    async verifyMappings() {
        logger.info('🔍 Verifying mappings...');
        
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_mappings,
                SUM(CASE WHEN mapping_method = 'auto' THEN 1 ELSE 0 END) as automatic_mappings,
                SUM(CASE WHEN mapping_confidence = 'high' THEN 1 ELSE 0 END) as high_confidence_mappings
            FROM opms_netsuite_vendor_mapping
        `);
        
        const stats = result[0];
        
        logger.info('📊 Mapping Statistics:');
        logger.info(`   Total mappings in database: ${stats.total_mappings}`);
        logger.info(`   Automatic mappings: ${stats.automatic_mappings}`);
        logger.info(`   High confidence mappings: ${stats.high_confidence_mappings}`);
        
        return stats;
    }

    /**
     * Print summary report
     */
    printSummary() {
        console.log('\n' + '═'.repeat(80));
        console.log('📊 AUTO-MAPPING COMPLETE - SUMMARY REPORT');
        console.log('═'.repeat(80));
        console.log(`\n✅ Successfully Created: ${this.mappingsCreated} mappings`);
        console.log(`❌ Failed: ${this.mappingsFailed} mappings`);
        console.log(`📈 Success Rate: ${((this.mappingsCreated / this.perfectMatches.length) * 100).toFixed(1)}%`);
        
        if (this.mappingsCreated > 0) {
            console.log('\n📋 Sample of created mappings (first 10):');
            console.log('─'.repeat(80));
            
            const successfulMappings = this.results.filter(r => r.success).slice(0, 10);
            successfulMappings.forEach((mapping, index) => {
                console.log(`${index + 1}. ${mapping.opms_vendor_name} (OPMS ID: ${mapping.opms_id}) → NetSuite ID: ${mapping.netsuite_id}`);
            });
            
            if (this.mappingsCreated > 10) {
                console.log(`   ... and ${this.mappingsCreated - 10} more`);
            }
        }
        
        if (this.mappingsFailed > 0) {
            console.log('\n❌ Failed mappings:');
            console.log('─'.repeat(80));
            
            const failedMappings = this.results.filter(r => !r.success);
            failedMappings.forEach((mapping, index) => {
                console.log(`${index + 1}. ${mapping.opms_vendor_name}: ${mapping.error}`);
            });
        }
        
        console.log('\n' + '═'.repeat(80));
        console.log('✅ Auto-mapping process complete!');
        console.log('═'.repeat(80) + '\n');
    }

    /**
     * Save results to file
     */
    async saveResults() {
        try {
            const outputPath = path.join(
                __dirname,
                '..',
                'DOCS',
                'NetSuite-Integrations',
                'NetSuite-Vendor-Extraction',
                'auto-mapping-results.json'
            );
            
            const report = {
                generated_at: new Date().toISOString(),
                summary: {
                    total_attempted: this.perfectMatches.length,
                    successful: this.mappingsCreated,
                    failed: this.mappingsFailed,
                    success_rate: ((this.mappingsCreated / this.perfectMatches.length) * 100).toFixed(1) + '%'
                },
                results: this.results
            };
            
            await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
            
            logger.info(`💾 Results saved to: ${outputPath}`);
            
        } catch (error) {
            logger.error('❌ Error saving results:', error.message);
        }
    }

    /**
     * Main execution
     */
    async run() {
        try {
            console.log('\n🚀 Starting Perfect Match Vendor Auto-Mapping...\n');
            
            // Load diagnostic report
            await this.loadDiagnosticReport();
            
            // Extract perfect matches
            this.extractPerfectMatches();
            
            if (this.perfectMatches.length === 0) {
                console.log('ℹ️  No perfect matches found to map.');
                return;
            }
            
            console.log(`\n📋 Found ${this.perfectMatches.length} vendors with 100% name match`);
            console.log('🎯 These will be automatically mapped with HIGH confidence\n');
            
            // Create mappings
            await this.createAllMappings();
            
            // Verify
            await this.verifyMappings();
            
            // Save results
            await this.saveResults();
            
            // Print summary
            this.printSummary();
            
            return {
                success: true,
                mappingsCreated: this.mappingsCreated,
                mappingsFailed: this.mappingsFailed
            };
            
        } catch (error) {
            logger.error('❌ Auto-mapping failed:', error.message);
            logger.error(error.stack);
            throw error;
        }
    }
}

// Run if executed directly
if (require.main === module) {
    const mapper = new PerfectMatchVendorMapper();
    mapper.run()
        .then(() => {
            console.log('✅ Auto-mapping completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Auto-mapping failed:', error.message);
            process.exit(1);
        });
}

module.exports = PerfectMatchVendorMapper;

