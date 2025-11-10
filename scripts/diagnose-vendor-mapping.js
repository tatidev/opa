#!/usr/bin/env node

/**
 * Vendor Mapping Diagnostic Script
 * 
 * Analyzes the current state of OPMS-NetSuite vendor mappings and identifies:
 * - Mapped vendors with matching names
 * - Mapped vendors with name mismatches
 * - Unmapped OPMS vendors
 * - Unmapped NetSuite vendors
 * - Data quality issues
 * 
 * Uses netsuite-vendors-fullData-PROD-template.json as source of truth for NetSuite names
 * 
 * Usage: node scripts/diagnose-vendor-mapping.js
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../src/db');
const logger = require('../src/utils/logger');

// Fuzzy string matching for suggestions
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Levenshtein distance
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    const maxLen = Math.max(s1.length, s2.length);
    const distance = matrix[s2.length][s1.length];
    return (maxLen - distance) / maxLen;
}

function findBestMatch(searchName, candidateList) {
    if (!searchName || !candidateList || candidateList.length === 0) {
        return null;
    }
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const candidate of candidateList) {
        const score = calculateSimilarity(searchName, candidate.name);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = { ...candidate, similarity: score };
        }
    }
    
    return bestScore >= 0.6 ? bestMatch : null;
}

class VendorMappingDiagnostic {
    constructor() {
        this.netsuiteVendors = [];
        this.opmsVendors = [];
        this.mappings = [];
        this.referenceTable = [];
        this.results = {
            summary: {},
            perfectMatches: [],
            nameMismatches: [],
            unmappedOpms: [],
            unmappedNetsuite: [],
            inactiveMappings: [],
            suggestions: []
        };
    }

    /**
     * Load NetSuite vendors from production JSON file (source of truth)
     */
    async loadNetSuiteVendors() {
        try {
            const jsonPath = path.join(
                __dirname,
                '..',
                'DOCS',
                'NetSuite-Integrations',
                'NetSuite-Vendor-Extraction',
                'netsuite-vendors-fullData-PROD-template.json'
            );
            
            logger.info('📥 Loading NetSuite vendors from production JSON...');
            const jsonContent = await fs.readFile(jsonPath, 'utf8');
            const data = JSON.parse(jsonContent);
            
            // Filter active vendors only
            this.netsuiteVendors = data.vendors
                .filter(v => !v.isinactive)
                .map(v => ({
                    id: parseInt(v.id),
                    entityid: v.entityid,
                    companyname: v.companyname,
                    displayname: v.displayName,
                    subsidiary: v.subsidiary,
                    subsidiaryId: v.subsidiaryId
                }));
            
            logger.info(`✅ Loaded ${this.netsuiteVendors.length} active NetSuite vendors`);
            logger.info(`📅 Data extracted: ${data.metadata.extractedAt}`);
            
        } catch (error) {
            logger.error('❌ Error loading NetSuite vendors:', error.message);
            throw error;
        }
    }

    /**
     * Load OPMS vendors from Z_VENDOR table
     */
    async loadOpmsVendors() {
        try {
            logger.info('📥 Loading OPMS vendors from Z_VENDOR table...');
            
            const query = `
                SELECT 
                    id,
                    name,
                    abrev as abbreviation,
                    active,
                    archived,
                    date_add as created_at,
                    date_modif as updated_at
                FROM Z_VENDOR
                WHERE active = 'Y' AND archived = 'N'
                ORDER BY name
            `;
            
            const rows = await db.query(query);
            this.opmsVendors = rows.map(v => ({
                id: v.id,
                name: v.name,
                abbreviation: v.abbreviation,
                active: v.active,
                archived: v.archived,
                created_at: v.created_at,
                updated_at: v.updated_at
            }));
            
            logger.info(`✅ Loaded ${this.opmsVendors.length} active OPMS vendors`);
            
        } catch (error) {
            logger.error('❌ Error loading OPMS vendors:', error.message);
            throw error;
        }
    }

    /**
     * Load existing vendor mappings
     */
    async loadMappings() {
        try {
            logger.info('📥 Loading vendor mappings from opms_netsuite_vendor_mapping...');
            
            const query = `
                SELECT 
                    id,
                    opms_vendor_id,
                    opms_vendor_name,
                    opms_vendor_abrev,
                    netsuite_vendor_id,
                    netsuite_vendor_name,
                    netsuite_vendor_entity_id,
                    is_active,
                    mapping_confidence,
                    mapping_method,
                    notes,
                    created_at,
                    updated_at
                FROM opms_netsuite_vendor_mapping
                ORDER BY opms_vendor_name
            `;
            
            const rows = await db.query(query);
            this.mappings = rows;
            
            logger.info(`✅ Loaded ${this.mappings.length} vendor mappings`);
            logger.info(`   - Active: ${rows.filter(m => m.is_active).length}`);
            logger.info(`   - Inactive: ${rows.filter(m => !m.is_active).length}`);
            
        } catch (error) {
            logger.error('❌ Error loading mappings:', error.message);
            throw error;
        }
    }

    /**
     * Load reference table data
     */
    async loadReferenceTable() {
        try {
            logger.info('📥 Loading NetSuite vendors reference table...');
            
            const query = `
                SELECT 
                    id,
                    entityid,
                    companyname,
                    displayname,
                    isinactive,
                    subsidiary,
                    subsidiary_id,
                    extracted_at
                FROM netsuite_vendors_reference
                WHERE isinactive = FALSE
                ORDER BY displayname
            `;
            
            const rows = await db.query(query);
            this.referenceTable = rows;
            
            logger.info(`✅ Loaded ${this.referenceTable.length} vendors from reference table`);
            
        } catch (error) {
            // Table might not exist yet
            logger.warn('⚠️  Reference table not found or empty');
            this.referenceTable = [];
        }
    }

    /**
     * Analyze mappings and identify issues
     */
    analyzeMappings() {
        logger.info('🔍 Analyzing vendor mappings...');
        
        const mappedOpmsIds = new Set();
        const mappedNetsuiteIds = new Set();
        
        // Analyze each mapping
        for (const mapping of this.mappings) {
            if (!mapping.is_active) {
                this.results.inactiveMappings.push(mapping);
                continue;
            }
            
            mappedOpmsIds.add(mapping.opms_vendor_id);
            mappedNetsuiteIds.add(mapping.netsuite_vendor_id);
            
            // Find actual vendor data
            const opmsVendor = this.opmsVendors.find(v => v.id === mapping.opms_vendor_id);
            const netsuiteVendor = this.netsuiteVendors.find(v => v.id === mapping.netsuite_vendor_id);
            
            if (!opmsVendor || !netsuiteVendor) {
                this.results.nameMismatches.push({
                    mapping,
                    issue: 'MISSING_VENDOR_DATA',
                    opmsVendor: opmsVendor || { id: mapping.opms_vendor_id, name: 'NOT FOUND' },
                    netsuiteVendor: netsuiteVendor || { id: mapping.netsuite_vendor_id, displayname: 'NOT FOUND' }
                });
                continue;
            }
            
            // Check for name consistency
            const opmsName = opmsVendor.name.trim();
            const netsuiteName = netsuiteVendor.displayname || netsuiteVendor.companyname;
            const mappingOpmsName = (mapping.opms_vendor_name || '').trim();
            const mappingNetsuiteName = (mapping.netsuite_vendor_name || '').trim();
            
            // Perfect match: all names align
            if (opmsName === netsuiteName && 
                opmsName === mappingOpmsName && 
                netsuiteName === mappingNetsuiteName) {
                this.results.perfectMatches.push({
                    mapping,
                    opmsVendor,
                    netsuiteVendor,
                    name: opmsName
                });
            } else {
                // Name mismatch
                const similarity = calculateSimilarity(opmsName, netsuiteName);
                this.results.nameMismatches.push({
                    mapping,
                    opmsVendor,
                    netsuiteVendor,
                    issue: 'NAME_MISMATCH',
                    details: {
                        opms_actual: opmsName,
                        opms_in_mapping: mappingOpmsName,
                        netsuite_actual: netsuiteName,
                        netsuite_in_mapping: mappingNetsuiteName,
                        similarity: similarity.toFixed(2),
                        passes_strict_check: opmsName === netsuiteName
                    }
                });
            }
        }
        
        // Find unmapped OPMS vendors
        for (const vendor of this.opmsVendors) {
            if (!mappedOpmsIds.has(vendor.id)) {
                // Try to find a potential NetSuite match
                const suggestion = findBestMatch(
                    vendor.name,
                    this.netsuiteVendors.map(v => ({ 
                        id: v.id, 
                        name: v.displayname || v.companyname 
                    }))
                );
                
                this.results.unmappedOpms.push({
                    vendor,
                    suggestion
                });
            }
        }
        
        // Find unmapped NetSuite vendors
        for (const vendor of this.netsuiteVendors) {
            if (!mappedNetsuiteIds.has(vendor.id)) {
                // Try to find a potential OPMS match
                const suggestion = findBestMatch(
                    vendor.displayname || vendor.companyname,
                    this.opmsVendors.map(v => ({ id: v.id, name: v.name }))
                );
                
                this.results.unmappedNetsuite.push({
                    vendor,
                    suggestion
                });
            }
        }
        
        logger.info('✅ Analysis complete');
    }

    /**
     * Generate summary statistics
     */
    generateSummary() {
        this.results.summary = {
            total_opms_vendors: this.opmsVendors.length,
            total_netsuite_vendors: this.netsuiteVendors.length,
            total_mappings: this.mappings.length,
            active_mappings: this.mappings.filter(m => m.is_active).length,
            inactive_mappings: this.results.inactiveMappings.length,
            perfect_matches: this.results.perfectMatches.length,
            name_mismatches: this.results.nameMismatches.length,
            unmapped_opms: this.results.unmappedOpms.length,
            unmapped_netsuite: this.results.unmappedNetsuite.length,
            mapping_coverage_opms: ((this.mappings.filter(m => m.is_active).length / this.opmsVendors.length) * 100).toFixed(1) + '%',
            mapping_coverage_netsuite: ((this.mappings.filter(m => m.is_active).length / this.netsuiteVendors.length) * 100).toFixed(1) + '%',
            strict_name_check_pass_rate: this.mappings.length > 0 
                ? ((this.results.perfectMatches.length / this.mappings.filter(m => m.is_active).length) * 100).toFixed(1) + '%'
                : '0%'
        };
    }

    /**
     * Generate actionable suggestions
     */
    generateSuggestions() {
        this.results.suggestions = [];
        
        // Suggestion 1: Fix mapping table name fields
        const mismatchesToFix = this.results.nameMismatches.filter(m => {
            return m.opmsVendor && m.netsuiteVendor && m.issue === 'NAME_MISMATCH';
        });
        
        if (mismatchesToFix.length > 0) {
            this.results.suggestions.push({
                priority: 'HIGH',
                type: 'UPDATE_MAPPING_NAMES',
                count: mismatchesToFix.length,
                description: 'Update opms_netsuite_vendor_mapping table to reflect actual vendor names',
                action: 'Run sync script to update opms_vendor_name and netsuite_vendor_name fields'
            });
        }
        
        // Suggestion 2: Update OPMS vendor names
        const needsOpmsUpdate = this.results.nameMismatches.filter(m => {
            return m.details && !m.details.passes_strict_check;
        });
        
        if (needsOpmsUpdate.length > 0) {
            this.results.suggestions.push({
                priority: 'HIGH',
                type: 'UPDATE_OPMS_NAMES',
                count: needsOpmsUpdate.length,
                description: 'Update Z_VENDOR.name to match NetSuite vendor names',
                action: 'Run vendor name sync script to align OPMS names with NetSuite',
                warning: 'This modifies legacy OPMS data - requires careful testing'
            });
        }
        
        // Suggestion 3: Create new mappings
        if (this.results.unmappedOpms.length > 0) {
            this.results.suggestions.push({
                priority: 'MEDIUM',
                type: 'CREATE_MAPPINGS_OPMS',
                count: this.results.unmappedOpms.length,
                description: 'Map unmapped OPMS vendors to NetSuite',
                action: 'Review suggestions and create mappings for OPMS vendors'
            });
        }
        
        // Suggestion 4: Remove or update reference table
        if (this.referenceTable.length === 0) {
            this.results.suggestions.push({
                priority: 'LOW',
                type: 'POPULATE_REFERENCE_TABLE',
                count: this.netsuiteVendors.length,
                description: 'Populate netsuite_vendors_reference table',
                action: 'Run: node scripts/populate-netsuite-vendors-reference.js'
            });
        }
        
        // Suggestion 5: Remove strict name check from queries
        if (this.results.nameMismatches.length > 0) {
            this.results.suggestions.push({
                priority: 'MEDIUM',
                type: 'MODIFY_QUERY_LOGIC',
                count: 'N/A',
                description: 'Remove strict name equality check from export queries',
                action: 'Update queries to trust mapping table IDs instead of requiring name matches',
                note: 'Alternative to fixing all name mismatches'
            });
        }
    }

    /**
     * Print detailed report
     */
    printReport() {
        console.log('\n' + '═'.repeat(80));
        console.log('📊 VENDOR MAPPING DIAGNOSTIC REPORT');
        console.log('═'.repeat(80));
        
        // Summary
        console.log('\n📈 SUMMARY STATISTICS');
        console.log('─'.repeat(80));
        console.log(`OPMS Vendors (Z_VENDOR):              ${this.results.summary.total_opms_vendors}`);
        console.log(`NetSuite Vendors (Production):        ${this.results.summary.total_netsuite_vendors}`);
        console.log(`Total Mappings:                        ${this.results.summary.total_mappings}`);
        console.log(`  ├─ Active:                           ${this.results.summary.active_mappings}`);
        console.log(`  └─ Inactive:                         ${this.results.summary.inactive_mappings}`);
        console.log(`Perfect Matches (all names align):    ${this.results.summary.perfect_matches} ✅`);
        console.log(`Name Mismatches:                       ${this.results.summary.name_mismatches} ⚠️`);
        console.log(`Unmapped OPMS Vendors:                 ${this.results.summary.unmapped_opms}`);
        console.log(`Unmapped NetSuite Vendors:             ${this.results.summary.unmapped_netsuite}`);
        console.log(`OPMS Mapping Coverage:                 ${this.results.summary.mapping_coverage_opms}`);
        console.log(`NetSuite Mapping Coverage:             ${this.results.summary.mapping_coverage_netsuite}`);
        console.log(`Strict Name Check Pass Rate:           ${this.results.summary.strict_name_check_pass_rate} 🎯`);
        
        // Perfect Matches
        if (this.results.perfectMatches.length > 0) {
            console.log('\n\n✅ PERFECT MATCHES (' + this.results.perfectMatches.length + ')');
            console.log('─'.repeat(80));
            console.log('These vendors have consistent names across all systems:\n');
            this.results.perfectMatches.slice(0, 10).forEach(match => {
                console.log(`  ✓ ${match.name}`);
                console.log(`    OPMS ID: ${match.opmsVendor.id} | NetSuite ID: ${match.netsuiteVendor.id}`);
            });
            if (this.results.perfectMatches.length > 10) {
                console.log(`  ... and ${this.results.perfectMatches.length - 10} more`);
            }
        }
        
        // Name Mismatches - CRITICAL
        if (this.results.nameMismatches.length > 0) {
            console.log('\n\n⚠️  NAME MISMATCHES (' + this.results.nameMismatches.length + ')');
            console.log('─'.repeat(80));
            console.log('❌ These mappings FAIL the strict name equality check used in export queries!\n');
            
            this.results.nameMismatches.forEach((mismatch, index) => {
                console.log(`${index + 1}. Mapping ID: ${mismatch.mapping.id}`);
                
                if (mismatch.issue === 'MISSING_VENDOR_DATA') {
                    console.log(`   ❌ ISSUE: Vendor data not found`);
                    console.log(`   OPMS Vendor: ${mismatch.opmsVendor.name} (ID: ${mismatch.opmsVendor.id})`);
                    console.log(`   NetSuite Vendor: ${mismatch.netsuiteVendor.displayname} (ID: ${mismatch.netsuiteVendor.id})`);
                } else {
                    console.log(`   OPMS (actual):         "${mismatch.details.opms_actual}"`);
                    console.log(`   OPMS (in mapping):     "${mismatch.details.opms_in_mapping}"`);
                    console.log(`   NetSuite (actual):     "${mismatch.details.netsuite_actual}"`);
                    console.log(`   NetSuite (in mapping): "${mismatch.details.netsuite_in_mapping}"`);
                    console.log(`   Similarity Score:      ${mismatch.details.similarity} (0-1)`);
                    console.log(`   Strict Check Passes:   ${mismatch.details.passes_strict_check ? '✅ YES' : '❌ NO'}`);
                }
                console.log('');
            });
        }
        
        // Unmapped OPMS Vendors
        if (this.results.unmappedOpms.length > 0) {
            console.log('\n\n📝 UNMAPPED OPMS VENDORS (' + this.results.unmappedOpms.length + ')');
            console.log('─'.repeat(80));
            console.log('These OPMS vendors have no mapping to NetSuite:\n');
            
            this.results.unmappedOpms.forEach((item, index) => {
                console.log(`${index + 1}. ${item.vendor.name} (ID: ${item.vendor.id})`);
                if (item.suggestion) {
                    console.log(`   💡 Suggested NetSuite match: "${item.suggestion.name}" (ID: ${item.suggestion.id})`);
                    console.log(`      Similarity: ${item.suggestion.similarity.toFixed(2)}`);
                } else {
                    console.log(`   ⚠️  No similar NetSuite vendor found`);
                }
                console.log('');
            });
        }
        
        // Unmapped NetSuite Vendors
        if (this.results.unmappedNetsuite.length > 0) {
            console.log('\n\n📝 UNMAPPED NETSUITE VENDORS (' + this.results.unmappedNetsuite.length + ')');
            console.log('─'.repeat(80));
            console.log('These NetSuite vendors have no mapping to OPMS:\n');
            
            this.results.unmappedNetsuite.slice(0, 20).forEach((item, index) => {
                const name = item.vendor.displayname || item.vendor.companyname;
                console.log(`${index + 1}. ${name} (ID: ${item.vendor.id})`);
                if (item.suggestion) {
                    console.log(`   💡 Suggested OPMS match: "${item.suggestion.name}" (ID: ${item.suggestion.id})`);
                    console.log(`      Similarity: ${item.suggestion.similarity.toFixed(2)}`);
                } else {
                    console.log(`   ⚠️  No similar OPMS vendor found`);
                }
                console.log('');
            });
            if (this.results.unmappedNetsuite.length > 20) {
                console.log(`  ... and ${this.results.unmappedNetsuite.length - 20} more`);
            }
        }
        
        // Actionable Suggestions
        console.log('\n\n💡 ACTIONABLE RECOMMENDATIONS');
        console.log('─'.repeat(80));
        
        if (this.results.suggestions.length === 0) {
            console.log('✅ No issues found! All mappings are perfect.\n');
        } else {
            this.results.suggestions.forEach((suggestion, index) => {
                const priorityIcon = suggestion.priority === 'HIGH' ? '🔴' : 
                                   suggestion.priority === 'MEDIUM' ? '🟡' : '🟢';
                console.log(`\n${index + 1}. ${priorityIcon} ${suggestion.type} [${suggestion.priority} PRIORITY]`);
                console.log(`   Count: ${suggestion.count}`);
                console.log(`   Description: ${suggestion.description}`);
                console.log(`   Action: ${suggestion.action}`);
                if (suggestion.warning) {
                    console.log(`   ⚠️  WARNING: ${suggestion.warning}`);
                }
                if (suggestion.note) {
                    console.log(`   ℹ️  Note: ${suggestion.note}`);
                }
            });
        }
        
        console.log('\n' + '═'.repeat(80));
        console.log('📊 END OF REPORT');
        console.log('═'.repeat(80) + '\n');
    }

    /**
     * Save detailed report to JSON file
     */
    async saveReport() {
        try {
            const outputDir = path.join(__dirname, '..', 'DOCS', 'NetSuite-Integrations', 'NetSuite-Vendor-Extraction');
            const outputPath = path.join(outputDir, 'vendor-mapping-diagnostic-report.json');
            
            const report = {
                generated_at: new Date().toISOString(),
                summary: this.results.summary,
                perfect_matches: this.results.perfectMatches,
                name_mismatches: this.results.nameMismatches,
                unmapped_opms: this.results.unmappedOpms,
                unmapped_netsuite: this.results.unmappedNetsuite,
                inactive_mappings: this.results.inactiveMappings,
                suggestions: this.results.suggestions
            };
            
            await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
            
            console.log(`\n💾 Detailed report saved to: ${outputPath}`);
            
        } catch (error) {
            logger.error('❌ Error saving report:', error.message);
        }
    }

    /**
     * Main diagnostic process
     */
    async run() {
        try {
            console.log('\n🚀 Starting Vendor Mapping Diagnostic...\n');
            
            // Load all data
            await this.loadNetSuiteVendors();
            await this.loadOpmsVendors();
            await this.loadMappings();
            await this.loadReferenceTable();
            
            // Analyze
            this.analyzeMappings();
            this.generateSummary();
            this.generateSuggestions();
            
            // Report
            this.printReport();
            await this.saveReport();
            
            console.log('\n✅ Diagnostic complete!\n');
            
            return this.results;
            
        } catch (error) {
            logger.error('❌ Diagnostic failed:', error.message);
            logger.error(error.stack);
            throw error;
        }
    }
}

// Run diagnostic if executed directly
if (require.main === module) {
    const diagnostic = new VendorMappingDiagnostic();
    diagnostic.run()
        .then(() => {
            console.log('🎉 Diagnostic completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Diagnostic failed:', error.message);
            process.exit(1);
        });
}

module.exports = VendorMappingDiagnostic;

