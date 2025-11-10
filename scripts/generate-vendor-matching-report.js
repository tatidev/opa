#!/usr/bin/env node

/**
 * Generate Human-Readable Vendor Matching Report
 * Creates formatted tables from the diagnostic JSON report
 */

const fs = require('fs').promises;
const path = require('path');

class VendorMatchingReportGenerator {
    constructor(reportPath) {
        this.reportPath = reportPath;
        this.data = null;
    }

    async load() {
        const content = await fs.readFile(this.reportPath, 'utf8');
        this.data = JSON.parse(content);
    }

    /**
     * Generate executive summary
     */
    generateExecutiveSummary() {
        const s = this.data.summary;
        
        let output = '\n';
        output += '═'.repeat(100) + '\n';
        output += '🚨 VENDOR MAPPING DIAGNOSTIC - EXECUTIVE SUMMARY\n';
        output += '═'.repeat(100) + '\n\n';
        
        output += '📊 CURRENT STATE:\n';
        output += '─'.repeat(100) + '\n';
        output += `Total OPMS Vendors:           ${s.total_opms_vendors}\n`;
        output += `Total NetSuite Vendors:       ${s.total_netsuite_vendors}\n`;
        output += `Existing Mappings:            ${s.total_mappings}\n`;
        output += `\n`;
        output += `✅ Perfect Matches:           ${s.perfect_matches} (${((s.perfect_matches / s.total_opms_vendors) * 100).toFixed(1)}% of OPMS vendors)\n`;
        output += `⚠️  Name Mismatches:           ${s.name_mismatches} (ALL MAPPED VENDORS ARE WRONG!)\n`;
        output += `📝 Unmapped OPMS Vendors:     ${s.unmapped_opms} (${s.mapping_coverage_opms} coverage)\n`;
        output += `📝 Unmapped NetSuite Vendors: ${s.unmapped_netsuite}\n`;
        output += `\n`;
        output += `🎯 CRITICAL METRICS:\n`;
        output += `   OPMS Mapping Coverage:     ${s.mapping_coverage_opms} ❌ (TARGET: 95%+)\n`;
        output += `   Strict Check Pass Rate:    ${s.strict_name_check_pass_rate} ❌ (TARGET: 100%)\n`;
        output += `\n`;
        
        // Severity assessment
        output += `🚨 SEVERITY: CRITICAL\n`;
        output += `\n`;
        output += `📋 ISSUES:\n`;
        output += `   1. Only ${s.total_mappings} vendors mapped out of ${s.total_opms_vendors} (${s.mapping_coverage_opms})\n`;
        output += `   2. All ${s.name_mismatches} existing mappings are INCORRECT\n`;
        output += `   3. ${s.unmapped_opms} OPMS vendors cannot be exported to NetSuite\n`;
        output += `   4. Export queries will fail for 100% of mapped vendors\n`;
        output += `\n`;
        
        output += `⚡ IMMEDIATE IMPACT:\n`;
        output += `   • ${((s.unmapped_opms / s.total_opms_vendors) * 100).toFixed(0)}% of OPMS vendors CANNOT be exported\n`;
        output += `   • Existing ${s.total_mappings} mappings point to WRONG NetSuite vendors\n`;
        output += `   • ALL item exports with vendors will FAIL\n`;
        output += `\n`;
        
        return output;
    }

    /**
     * Generate broken mappings table
     */
    generateBrokenMappingsTable() {
        let output = '\n';
        output += '═'.repeat(100) + '\n';
        output += '❌ BROKEN MAPPINGS - THESE ARE MAPPED TO WRONG VENDORS!\n';
        output += '═'.repeat(100) + '\n\n';
        
        if (this.data.name_mismatches.length === 0) {
            output += '✅ No broken mappings found!\n\n';
            return output;
        }
        
        output += `Found ${this.data.name_mismatches.length} incorrect mappings:\n\n`;
        
        this.data.name_mismatches.forEach((mismatch, index) => {
            const opmsName = mismatch.details?.opms_actual || mismatch.opmsVendor?.name || 'Unknown';
            const nsName = mismatch.details?.netsuite_actual || mismatch.netsuiteVendor?.displayname || 'Unknown';
            const similarity = mismatch.details?.similarity || '0.00';
            
            output += `${index + 1}. MAPPING ID: ${mismatch.mapping.id}\n`;
            output += `   ─────────────────────────────────────────────────────────────────────────────\n`;
            output += `   OPMS Vendor (ID ${mismatch.opmsVendor.id}):\n`;
            output += `      Name: "${opmsName}"\n`;
            output += `      Abbr: ${mismatch.opmsVendor.abbreviation || 'N/A'}\n`;
            output += `\n`;
            output += `   ❌ MAPPED TO WRONG NetSuite Vendor (ID ${mismatch.netsuiteVendor.id}):\n`;
            output += `      Name: "${nsName}"\n`;
            output += `      Entity ID: ${mismatch.netsuiteVendor.entityid}\n`;
            output += `\n`;
            output += `   📊 Details:\n`;
            output += `      Similarity Score: ${similarity} (0.0 = completely different)\n`;
            output += `      Mapping Method: ${mismatch.mapping.mapping_method}\n`;
            output += `      Created: ${new Date(mismatch.mapping.created_at).toLocaleDateString()}\n`;
            output += `\n`;
            output += `   🔧 ACTION REQUIRED:\n`;
            output += `      1. Delete this incorrect mapping (ID ${mismatch.mapping.id})\n`;
            output += `      2. Create correct mapping for "${opmsName}"\n`;
            output += `\n`;
        });
        
        return output;
    }

    /**
     * Generate top priority unmapped OPMS vendors
     */
    generateTopUnmappedOpms() {
        let output = '\n';
        output += '═'.repeat(100) + '\n';
        output += '📝 TOP PRIORITY UNMAPPED OPMS VENDORS (with NetSuite suggestions)\n';
        output += '═'.repeat(100) + '\n\n';
        
        // Sort by suggestion similarity (highest first)
        const sortedUnmapped = [...this.data.unmapped_opms]
            .filter(item => item.suggestion && item.suggestion.similarity >= 0.60)
            .sort((a, b) => b.suggestion.similarity - a.suggestion.similarity)
            .slice(0, 30); // Top 30
        
        if (sortedUnmapped.length === 0) {
            output += 'No unmapped OPMS vendors with good NetSuite matches found.\n\n';
            return output;
        }
        
        output += `Showing top ${sortedUnmapped.length} OPMS vendors with likely NetSuite matches:\n\n`;
        output += `${'#'.padEnd(4)} ${'OPMS Vendor'.padEnd(30)} ${'ID'.padEnd(6)} ${'→ Suggested NetSuite Match'.padEnd(40)} ${'Sim'.padEnd(6)}\n`;
        output += '─'.repeat(100) + '\n';
        
        sortedUnmapped.forEach((item, index) => {
            const num = (index + 1).toString().padEnd(4);
            const opmsName = item.vendor.name.substring(0, 28).padEnd(30);
            const opmsId = item.vendor.id.toString().padEnd(6);
            const nsName = item.suggestion.name.substring(0, 38).padEnd(40);
            const sim = item.suggestion.similarity.toFixed(2).padEnd(6);
            const confidence = item.suggestion.similarity >= 0.90 ? '🟢' : 
                             item.suggestion.similarity >= 0.75 ? '🟡' : '🟠';
            
            output += `${num} ${opmsName} ${opmsId} → ${nsName} ${sim} ${confidence}\n`;
        });
        
        output += '\n';
        output += 'Legend: 🟢 = Very confident (0.90+)  🟡 = Likely match (0.75+)  🟠 = Possible match (0.60+)\n';
        output += '\n';
        
        return output;
    }

    /**
     * Generate OPMS vendors with NO suggestions
     */
    generateNoMatchOpms() {
        let output = '\n';
        output += '═'.repeat(100) + '\n';
        output += '⚠️  OPMS VENDORS WITH NO NETSUITE MATCH FOUND\n';
        output += '═'.repeat(100) + '\n\n';
        
        const noMatches = this.data.unmapped_opms
            .filter(item => !item.suggestion || item.suggestion.similarity < 0.60)
            .slice(0, 20); // First 20
        
        if (noMatches.length === 0) {
            output += '✅ All OPMS vendors have potential NetSuite matches!\n\n';
            return output;
        }
        
        output += `These ${noMatches.length} OPMS vendors have no similar NetSuite vendor (manual review needed):\n\n`;
        output += `${'#'.padEnd(4)} ${'OPMS Vendor Name'.padEnd(40)} ${'ID'.padEnd(6)} ${'Abbr'.padEnd(8)}\n`;
        output += '─'.repeat(100) + '\n';
        
        noMatches.forEach((item, index) => {
            const num = (index + 1).toString().padEnd(4);
            const name = item.vendor.name.substring(0, 38).padEnd(40);
            const id = item.vendor.id.toString().padEnd(6);
            const abbr = (item.vendor.abbreviation || 'N/A').padEnd(8);
            
            output += `${num} ${name} ${id} ${abbr}\n`;
        });
        
        output += '\n';
        output += '💡 These vendors may:\n';
        output += '   - Not exist in NetSuite yet (need to be added to NetSuite first)\n';
        output += '   - Have completely different names in NetSuite (manual mapping required)\n';
        output += '   - Be obsolete vendors no longer used\n';
        output += '\n';
        
        return output;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations() {
        let output = '\n';
        output += '═'.repeat(100) + '\n';
        output += '💡 RECOMMENDED ACTION PLAN\n';
        output += '═'.repeat(100) + '\n\n';
        
        const s = this.data.summary;
        
        output += '🔴 PHASE 1: FIX BROKEN MAPPINGS (IMMEDIATE - 15 minutes)\n';
        output += '─'.repeat(100) + '\n';
        output += `   Delete ${this.data.name_mismatches.length} incorrect mappings:\n`;
        this.data.name_mismatches.forEach(m => {
            const opmsName = m.details?.opms_actual || m.opmsVendor?.name || 'Unknown';
            const nsName = m.details?.netsuite_actual || m.netsuiteVendor?.displayname || 'Unknown';
            output += `   • DELETE mapping ID ${m.mapping.id} (${opmsName} → WRONG: ${nsName})\n`;
        });
        output += '\n';
        output += '   SQL Command:\n';
        output += '   ```sql\n';
        output += '   DELETE FROM opms_netsuite_vendor_mapping WHERE id IN (';
        output += this.data.name_mismatches.map(m => m.mapping.id).join(', ');
        output += ');\n';
        output += '   ```\n\n';
        
        output += '🟡 PHASE 2: CREATE HIGH-CONFIDENCE MAPPINGS (1-2 hours)\n';
        output += '─'.repeat(100) + '\n';
        const highConfidence = this.data.unmapped_opms.filter(i => i.suggestion && i.suggestion.similarity >= 0.90);
        output += `   ${highConfidence.length} vendors with 90%+ match confidence\n`;
        output += '   These can be auto-mapped with high confidence\n';
        output += '   Script: node scripts/auto-map-high-confidence-vendors.js\n\n';
        
        output += '🟡 PHASE 3: REVIEW AND MAP LIKELY MATCHES (2-4 hours)\n';
        output += '─'.repeat(100) + '\n';
        const likelyMatches = this.data.unmapped_opms.filter(i => i.suggestion && i.suggestion.similarity >= 0.75 && i.suggestion.similarity < 0.90);
        output += `   ${likelyMatches.length} vendors with 75-89% match confidence\n`;
        output += '   These need quick manual review before mapping\n';
        output += '   Tool: Web UI for bulk vendor mapping approval\n\n';
        
        output += '🟠 PHASE 4: MANUAL MAPPING (4-8 hours)\n';
        output += '─'.repeat(100) + '\n';
        const possibleMatches = this.data.unmapped_opms.filter(i => i.suggestion && i.suggestion.similarity >= 0.60 && i.suggestion.similarity < 0.75);
        output += `   ${possibleMatches.length} vendors with 60-74% match confidence\n`;
        const noMatches = this.data.unmapped_opms.filter(i => !i.suggestion || i.suggestion.similarity < 0.60);
        output += `   ${noMatches.length} vendors with no close matches\n`;
        output += '   These require careful manual mapping\n\n';
        
        output += '📊 ESTIMATED TIMELINE:\n';
        output += '─'.repeat(100) + '\n';
        output += '   Immediate (today):    Phase 1 - Fix broken mappings\n';
        output += '   Day 1-2:             Phase 2 - Auto-map high confidence\n';
        output += '   Week 1:              Phase 3 - Review likely matches\n';
        output += '   Week 1-2:            Phase 4 - Manual mapping remainder\n\n';
        
        output += '🎯 SUCCESS METRICS:\n';
        output += '─'.repeat(100) + '\n';
        output += '   Target OPMS Mapping Coverage:      95%+ (currently ' + s.mapping_coverage_opms + ')\n';
        output += '   Target Strict Check Pass Rate:     100% (currently ' + s.strict_name_check_pass_rate + ')\n';
        output += '   Target Perfect Matches:            233+ vendors (95% of 245)\n\n';
        
        return output;
    }

    /**
     * Generate complete report
     */
    async generate() {
        let report = '';
        
        try {
            report += this.generateExecutiveSummary();
        } catch (error) {
            console.error('Error in generateExecutiveSummary:', error.message);
            throw error;
        }
        
        try {
            report += this.generateBrokenMappingsTable();
        } catch (error) {
            console.error('Error in generateBrokenMappingsTable:', error.message);
            throw error;
        }
        
        try {
            report += this.generateTopUnmappedOpms();
        } catch (error) {
            console.error('Error in generateTopUnmappedOpms:', error.message);
            throw error;
        }
        
        try {
            report += this.generateNoMatchOpms();
        } catch (error) {
            console.error('Error in generateNoMatchOpms:', error.message);
            throw error;
        }
        
        try {
            report += this.generateRecommendations();
        } catch (error) {
            console.error('Error in generateRecommendations:', error.message);
            throw error;
        }
        
        report += '\n';
        report += '═'.repeat(100) + '\n';
        report += '📄 END OF VENDOR MATCHING DIAGNOSTIC REPORT\n';
        report += '═'.repeat(100) + '\n';
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Source: ${this.reportPath}\n`;
        report += '\n';
        
        return report;
    }

    /**
     * Save report to file
     */
    async save(outputPath, content) {
        await fs.writeFile(outputPath, content, 'utf8');
        console.log(`✅ Report saved to: ${outputPath}`);
    }
}

// Main execution
async function main() {
    const reportPath = path.join(
        __dirname,
        '..',
        'DOCS',
        'NetSuite-Integrations',
        'NetSuite-Vendor-Extraction',
        'vendor-mapping-diagnostic-report.json'
    );
    
    const outputPath = path.join(
        __dirname,
        '..',
        'DOCS',
        'NetSuite-Integrations',
        'NetSuite-Vendor-Extraction',
        'VENDOR-MATCHING-ANALYSIS.txt'
    );
    
    console.log('📊 Generating vendor matching analysis report...\n');
    
    const generator = new VendorMatchingReportGenerator(reportPath);
    await generator.load();
    
    const report = await generator.generate();
    
    // Print to console
    console.log(report);
    
    // Save to file
    await generator.save(outputPath, report);
    
    console.log('\n✅ Report generation complete!');
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error generating report:', error.message);
        process.exit(1);
    });
}

module.exports = VendorMatchingReportGenerator;

