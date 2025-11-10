#!/usr/bin/env node

/**
 * Phase 3: Smart Vendor Matching Algorithm
 * 
 * Implements multi-tier matching for remaining unmapped OPMS vendors
 * NetSuite is the source of truth for vendor names
 * 
 * Tiers:
 * - Tier 1 (≥0.90): Auto-map with high confidence
 * - Tier 2 (0.75-0.89): Generate CSV for approval
 * - Tier 3 (0.60-0.74): Flag for manual review
 * - Tier 4 (<0.60): Leave unmapped (no good match)
 * 
 * Usage: node scripts/smart-vendor-matching-phase3.js
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../src/db');
const logger = require('../src/utils/logger');

class SmartVendorMatcher {
    constructor() {
        this.diagnosticReport = null;
        this.unmappedOpmsVendors = [];
        this.netsuiteVendors = [];
        
        // Results by tier
        this.tier1AutoMapped = [];
        this.tier2ForApproval = [];
        this.tier3ForReview = [];
        this.tier4NoMatch = [];
        this.conflicts = [];
        
        // Statistics
        this.stats = {
            total_processed: 0,
            tier1_auto: 0,
            tier2_approval: 0,
            tier3_review: 0,
            tier4_no_match: 0,
            conflicts_found: 0
        };
    }

    /**
     * Load diagnostic report
     */
    async loadDiagnosticReport() {
        try {
            logger.info('📥 Loading latest diagnostic report...');
            
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
            
            // Extract unmapped OPMS vendors
            this.unmappedOpmsVendors = this.diagnosticReport.unmapped_opms
                .map(item => ({
                    opms_id: item.vendor.id,
                    opms_name: item.vendor.name,
                    opms_abrev: item.vendor.abbreviation,
                    suggestion: item.suggestion // May be null
                }));
            
            // Load NetSuite vendors from diagnostic
            const nsVendorsPath = path.join(
                __dirname,
                '..',
                'DOCS',
                'NetSuite-Integrations',
                'NetSuite-Vendor-Extraction',
                'netsuite-vendors-fullData-PROD-template.json'
            );
            
            const nsContent = await fs.readFile(nsVendorsPath, 'utf8');
            const nsData = JSON.parse(nsContent);
            this.netsuiteVendors = nsData.vendors
                .filter(v => !v.isinactive)
                .map(v => ({
                    netsuite_id: v.id,
                    netsuite_name: v.displayName || v.companyname,
                    entity_id: v.entityid
                }));
            
            logger.info(`✅ Loaded ${this.unmappedOpmsVendors.length} unmapped OPMS vendors`);
            logger.info(`✅ Loaded ${this.netsuiteVendors.length} NetSuite vendors`);
            
        } catch (error) {
            logger.error('❌ Error loading data:', error.message);
            throw error;
        }
    }

    /**
     * Normalize vendor name for matching
     */
    normalizeVendorName(name) {
        if (!name) return '';
        
        let normalized = name.toLowerCase();
        
        // Remove common suffixes
        const suffixes = [
            'inc\\.?', 'llc\\.?', 'corp\\.?', 'corporation', 'ltd\\.?', 'limited',
            'company', 'co\\.?', 'fabrics?', 'textiles?', 'textile', 'design',
            '@ home', 'international', 'intl\\.?'
        ];
        
        for (const suffix of suffixes) {
            const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
            normalized = normalized.replace(regex, '');
        }
        
        // Standardize separators
        normalized = normalized.replace(/&/g, 'and');
        normalized = normalized.replace(/\//g, ' ');
        normalized = normalized.replace(/\./g, '');
        normalized = normalized.replace(/,/g, '');
        
        // Remove extra spaces
        normalized = normalized.replace(/\s+/g, ' ').trim();
        
        return normalized;
    }

    /**
     * Calculate similarity between two strings (Levenshtein-based)
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = this.normalizeVendorName(str1);
        const s2 = this.normalizeVendorName(str2);
        
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

    /**
     * Find best NetSuite matches for an OPMS vendor
     */
    findBestMatches(opmsVendor, topN = 5) {
        const matches = [];
        
        for (const nsVendor of this.netsuiteVendors) {
            const similarity = this.calculateSimilarity(
                opmsVendor.opms_name,
                nsVendor.netsuite_name
            );
            
            if (similarity > 0) {
                matches.push({
                    ...nsVendor,
                    similarity: similarity,
                    similarity_display: (similarity * 100).toFixed(1) + '%'
                });
            }
        }
        
        // Sort by similarity (highest first)
        matches.sort((a, b) => b.similarity - a.similarity);
        
        return matches.slice(0, topN);
    }

    /**
     * Check if this NetSuite vendor is already being used
     */
    async checkForConflict(netsuiteId, opmsId) {
        const existing = await db.query(
            'SELECT opms_vendor_id, opms_vendor_name FROM opms_netsuite_vendor_mapping WHERE netsuite_vendor_id = ? AND opms_vendor_id != ?',
            [netsuiteId, opmsId]
        );
        
        return existing.length > 0 ? existing[0] : null;
    }

    /**
     * Create a mapping
     */
    async createMapping(opmsVendor, nsVendor, confidence, method, notes = null) {
        try {
            const query = `
                INSERT INTO opms_netsuite_vendor_mapping 
                (
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
                )
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW(), NOW())
            `;
            
            const fullNotes = notes || `Similarity: ${nsVendor.similarity_display}`;
            
            await db.query(query, [
                opmsVendor.opms_id,
                opmsVendor.opms_name,
                opmsVendor.opms_abrev || null,
                nsVendor.netsuite_id,
                nsVendor.netsuite_name,
                nsVendor.entity_id || null,
                confidence,
                method,
                fullNotes
            ]);
            
            return true;
            
        } catch (error) {
            logger.error(`❌ Failed to create mapping for ${opmsVendor.opms_name}:`, error.message);
            return false;
        }
    }

    /**
     * Process all unmapped vendors through the matching algorithm
     */
    async processVendors() {
        logger.info('🔍 Starting smart matching algorithm...');
        
        for (const opmsVendor of this.unmappedOpmsVendors) {
            this.stats.total_processed++;
            
            // Find best matches
            const matches = this.findBestMatches(opmsVendor, 5);
            
            if (matches.length === 0) {
                // No matches at all
                this.tier4NoMatch.push({
                    opms_id: opmsVendor.opms_id,
                    opms_name: opmsVendor.opms_name,
                    opms_abrev: opmsVendor.opms_abrev,
                    reason: 'No NetSuite vendors found'
                });
                this.stats.tier4_no_match++;
                continue;
            }
            
            const bestMatch = matches[0];
            
            // Check for conflicts
            const conflict = await this.checkForConflict(bestMatch.netsuite_id, opmsVendor.opms_id);
            
            // Classify by tier based on similarity
            if (bestMatch.similarity >= 0.90) {
                // TIER 1: Auto-map
                const notes = conflict 
                    ? `Auto-mapped (Tier 1). CONFLICT: Also mapped from OPMS vendor "${conflict.opms_vendor_name}" (ID: ${conflict.opms_vendor_id}). Similarity: ${bestMatch.similarity_display}`
                    : `Auto-mapped (Tier 1). Similarity: ${bestMatch.similarity_display}`;
                
                await this.createMapping(opmsVendor, bestMatch, 'high', 'auto', notes);
                
                this.tier1AutoMapped.push({
                    opms_id: opmsVendor.opms_id,
                    opms_name: opmsVendor.opms_name,
                    opms_abrev: opmsVendor.opms_abrev,
                    netsuite_id: bestMatch.netsuite_id,
                    netsuite_name: bestMatch.netsuite_name,
                    netsuite_entity_id: bestMatch.entity_id,
                    similarity: bestMatch.similarity_display,
                    conflict: conflict ? 'YES' : 'NO',
                    conflict_with_opms_id: conflict ? conflict.opms_vendor_id : null,
                    conflict_with_opms_name: conflict ? conflict.opms_vendor_name : null
                });
                
                this.stats.tier1_auto++;
                
                if (conflict) {
                    this.conflicts.push({
                        netsuite_id: bestMatch.netsuite_id,
                        netsuite_name: bestMatch.netsuite_name,
                        opms_vendors: [
                            { id: conflict.opms_vendor_id, name: conflict.opms_vendor_name },
                            { id: opmsVendor.opms_id, name: opmsVendor.opms_name }
                        ]
                    });
                    this.stats.conflicts_found++;
                }
                
                logger.info(`✅ Tier 1 auto-mapped: ${opmsVendor.opms_name} → ${bestMatch.netsuite_name} (${bestMatch.similarity_display})`);
                
            } else if (bestMatch.similarity >= 0.75) {
                // TIER 2: Queue for approval
                this.tier2ForApproval.push({
                    opms_id: opmsVendor.opms_id,
                    opms_name: opmsVendor.opms_name,
                    opms_abrev: opmsVendor.opms_abrev,
                    suggested_netsuite_id: bestMatch.netsuite_id,
                    suggested_netsuite_name: bestMatch.netsuite_name,
                    suggested_netsuite_entity_id: bestMatch.entity_id,
                    similarity: bestMatch.similarity_display,
                    alternative_1_name: matches[1] ? matches[1].netsuite_name : '',
                    alternative_1_id: matches[1] ? matches[1].netsuite_id : '',
                    alternative_1_similarity: matches[1] ? matches[1].similarity_display : '',
                    alternative_2_name: matches[2] ? matches[2].netsuite_name : '',
                    alternative_2_id: matches[2] ? matches[2].netsuite_id : '',
                    alternative_2_similarity: matches[2] ? matches[2].similarity_display : '',
                    conflict: conflict ? 'YES' : 'NO',
                    conflict_with: conflict ? `${conflict.opms_vendor_name} (ID: ${conflict.opms_vendor_id})` : '',
                    action: '' // User will fill this in CSV
                });
                
                this.stats.tier2_approval++;
                logger.info(`🟡 Tier 2 for approval: ${opmsVendor.opms_name} → ${bestMatch.netsuite_name} (${bestMatch.similarity_display})`);
                
            } else if (bestMatch.similarity >= 0.60) {
                // TIER 3: Manual review needed
                this.tier3ForReview.push({
                    opms_id: opmsVendor.opms_id,
                    opms_name: opmsVendor.opms_name,
                    opms_abrev: opmsVendor.opms_abrev,
                    top_match_name: bestMatch.netsuite_name,
                    top_match_id: bestMatch.netsuite_id,
                    top_match_similarity: bestMatch.similarity_display,
                    match_2: matches[1] ? `${matches[1].netsuite_name} (${matches[1].similarity_display})` : '',
                    match_3: matches[2] ? `${matches[2].netsuite_name} (${matches[2].similarity_display})` : '',
                    match_4: matches[3] ? `${matches[3].netsuite_name} (${matches[3].similarity_display})` : '',
                    match_5: matches[4] ? `${matches[4].netsuite_name} (${matches[4].similarity_display})` : '',
                    notes: ''
                });
                
                this.stats.tier3_review++;
                logger.info(`🟠 Tier 3 for review: ${opmsVendor.opms_name} → ${bestMatch.netsuite_name} (${bestMatch.similarity_display})`);
                
            } else {
                // TIER 4: No good match
                this.tier4NoMatch.push({
                    opms_id: opmsVendor.opms_id,
                    opms_name: opmsVendor.opms_name,
                    opms_abrev: opmsVendor.opms_abrev,
                    best_match: bestMatch.netsuite_name,
                    best_similarity: bestMatch.similarity_display,
                    reason: 'Similarity too low (<60%)'
                });
                
                this.stats.tier4_no_match++;
                logger.info(`⚪ Tier 4 no match: ${opmsVendor.opms_name} (best: ${bestMatch.netsuite_name} at ${bestMatch.similarity_display})`);
            }
        }
        
        logger.info('✅ Smart matching complete');
    }

    /**
     * Generate CSV file for Tier 2 approvals
     */
    async generateTier2CSV() {
        if (this.tier2ForApproval.length === 0) {
            logger.info('ℹ️  No Tier 2 vendors require approval');
            return null;
        }
        
        const csvPath = path.join(
            __dirname,
            '..',
            'DOCS',
            'NetSuite-Integrations',
            'NetSuite-Vendor-Extraction',
            'tier2-vendor-approvals.csv'
        );
        
        // CSV Header
        let csv = 'OPMS_ID,OPMS_Vendor_Name,OPMS_Abbrev,Suggested_NS_ID,Suggested_NS_Name,Suggested_NS_Entity_ID,Similarity,Alternative_1_Name,Alternative_1_ID,Alternative_1_Similarity,Alternative_2_Name,Alternative_2_ID,Alternative_2_Similarity,Conflict,Conflict_With,ACTION (approve/reject/edit)\n';
        
        // Add rows
        for (const item of this.tier2ForApproval) {
            csv += `${item.opms_id},"${item.opms_name}","${item.opms_abrev || ''}",${item.suggested_netsuite_id},"${item.suggested_netsuite_name}","${item.suggested_netsuite_entity_id || ''}",${item.similarity},"${item.alternative_1_name}",${item.alternative_1_id},${item.alternative_1_similarity},"${item.alternative_2_name}",${item.alternative_2_id},${item.alternative_2_similarity},${item.conflict},"${item.conflict_with}",\n`;
        }
        
        await fs.writeFile(csvPath, csv, 'utf8');
        logger.info(`📄 Tier 2 CSV saved to: ${csvPath}`);
        
        return csvPath;
    }

    /**
     * Generate summary report
     */
    async generateReport() {
        const reportPath = path.join(
            __dirname,
            '..',
            'DOCS',
            'NetSuite-Integrations',
            'NetSuite-Vendor-Extraction',
            'phase3-smart-matching-results.json'
        );
        
        const report = {
            generated_at: new Date().toISOString(),
            statistics: this.stats,
            tier1_auto_mapped: this.tier1AutoMapped,
            tier2_for_approval: this.tier2ForApproval,
            tier3_for_review: this.tier3ForReview,
            tier4_no_match: this.tier4NoMatch,
            conflicts: this.conflicts
        };
        
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
        logger.info(`💾 Full report saved to: ${reportPath}`);
        
        return reportPath;
    }

    /**
     * Print summary to console
     */
    printSummary() {
        console.log('\n' + '═'.repeat(80));
        console.log('📊 PHASE 3: SMART MATCHING RESULTS');
        console.log('═'.repeat(80));
        console.log(`\n📈 STATISTICS:`);
        console.log(`   Total Processed:           ${this.stats.total_processed}`);
        console.log(`   🟢 Tier 1 (Auto-mapped):   ${this.stats.tier1_auto} (≥90% similarity)`);
        console.log(`   🟡 Tier 2 (For Approval):  ${this.stats.tier2_approval} (75-89% similarity)`);
        console.log(`   🟠 Tier 3 (Manual Review):  ${this.stats.tier3_review} (60-74% similarity)`);
        console.log(`   ⚪ Tier 4 (No Match):       ${this.stats.tier4_no_match} (<60% similarity)`);
        console.log(`   ⚠️  Conflicts Found:         ${this.stats.conflicts_found}`);
        
        if (this.tier1AutoMapped.length > 0) {
            console.log(`\n✅ TIER 1: AUTO-MAPPED (${this.tier1AutoMapped.length} vendors)`);
            console.log('─'.repeat(80));
            this.tier1AutoMapped.slice(0, 10).forEach((item, index) => {
                const conflict = item.conflict === 'YES' ? ' ⚠️ CONFLICT' : '';
                console.log(`${index + 1}. ${item.opms_name} → ${item.netsuite_name} (${item.similarity})${conflict}`);
            });
            if (this.tier1AutoMapped.length > 10) {
                console.log(`   ... and ${this.tier1AutoMapped.length - 10} more`);
            }
        }
        
        if (this.tier2ForApproval.length > 0) {
            console.log(`\n🟡 TIER 2: REQUIRES APPROVAL (${this.tier2ForApproval.length} vendors)`);
            console.log('─'.repeat(80));
            console.log(`📄 CSV file generated for review: tier2-vendor-approvals.csv`);
            console.log(`   Review the CSV and fill in the ACTION column with:`);
            console.log(`   - "approve" to accept the suggested mapping`);
            console.log(`   - "reject" to skip this vendor`);
            console.log(`   - Edit the Suggested_NS_ID to map to a different vendor`);
        }
        
        if (this.conflicts.length > 0) {
            console.log(`\n⚠️  CONFLICTS (${this.conflicts.length} NetSuite vendors)`);
            console.log('─'.repeat(80));
            console.log(`These NetSuite vendors are mapped to multiple OPMS vendors:`);
            this.conflicts.forEach((conflict, index) => {
                console.log(`\n${index + 1}. NetSuite: ${conflict.netsuite_name} (ID: ${conflict.netsuite_id})`);
                console.log(`   Mapped from:`);
                conflict.opms_vendors.forEach(v => {
                    console.log(`   - OPMS: ${v.name} (ID: ${v.id})`);
                });
            });
            console.log(`\n   Action: Review these conflicts to ensure they are correct.`);
        }
        
        console.log('\n' + '═'.repeat(80));
        console.log('✅ Phase 3 Smart Matching Complete!');
        console.log('═'.repeat(80) + '\n');
    }

    /**
     * Main execution
     */
    async run() {
        try {
            console.log('\n🚀 Starting Phase 3: Smart Vendor Matching...\n');
            
            // Load data
            await this.loadDiagnosticReport();
            
            // Process all vendors
            await this.processVendors();
            
            // Generate outputs
            await this.generateTier2CSV();
            await this.generateReport();
            
            // Print summary
            this.printSummary();
            
            return {
                success: true,
                stats: this.stats
            };
            
        } catch (error) {
            logger.error('❌ Phase 3 matching failed:', error.message);
            logger.error(error.stack);
            throw error;
        }
    }
}

// Run if executed directly
if (require.main === module) {
    const matcher = new SmartVendorMatcher();
    matcher.run()
        .then(() => {
            console.log('✅ Phase 3 completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Phase 3 failed:', error.message);
            process.exit(1);
        });
}

module.exports = SmartVendorMatcher;

